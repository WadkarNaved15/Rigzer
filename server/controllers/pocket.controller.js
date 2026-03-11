// controllers/pocket.controller.js
import Pocket          from "../models/Pocket.js";
import PocketFeedEntry from "../models/PocketFeedEntry.js";
import User            from "../models/User.js";
import { compilePocketBundle } from "../services/pocketCompiler.service.js";
import { uploadBundleToCDN, deleteBundleFromCDN, invalidateCDNPath } from "../services/pocketCDN.service.js";

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/pockets/eligibility/:userId   (admin only)
───────────────────────────────────────────────────────────────────────────── */
export const setPocketEligibility = async (req, res) => {
  try {
    const { eligible } = req.body;
    if (typeof eligible !== "boolean") {
      return res.status(400).json({ message: "eligible must be true or false" });
    }
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isPocketEligible: eligible },
      { new: true, select: "username email isPocketEligible" }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({
      message: `Pocket eligibility ${eligible ? "granted" : "revoked"} for ${user.username}`,
      user,
    });
  } catch (err) {
    console.error("setPocketEligibility:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/pockets/pending   (admin only)
───────────────────────────────────────────────────────────────────────────── */
export const getPendingPockets = async (req, res) => {
  try {
    console.log("Admin requested pending pockets for review");
    const pockets = await Pocket.find({ status: "pending_review" })
      .populate("owner", "username avatar email")
      .sort({ updatedAt: -1 })
      .lean();
    console.log(`Fetched ${pockets.length} pending pockets for review`);
    return res.status(200).json({ pockets });
  } catch (err) {
    console.error("getPendingPockets:", err);
    return res.status(500).json({ message: "Failed to fetch pending pockets" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/pockets/mine
───────────────────────────────────────────────────────────────────────────── */
export const getMyPocket = async (req, res) => {
  try {
    const pocket = await Pocket.findOne({ owner: req.user.id }).lean();
    return res.status(200).json({ pocket: pocket ?? null });
  } catch (err) {
    console.error("getMyPocket:", err);
    return res.status(500).json({ message: "Failed to fetch pocket" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/pockets   —   upsert draft
───────────────────────────────────────────────────────────────────────────── */
export const upsertPocket = async (req, res) => {
  try {
    const { brandName, tagline, sourceCode } = req.body;
    if (!brandName?.trim() || !sourceCode?.trim()) {
      return res.status(400).json({ message: "brandName and sourceCode are required" });
    }
    if (sourceCode.length > 60_000) {
      return res.status(400).json({ message: "sourceCode exceeds 60,000 character limit" });
    }
    const existing = await Pocket.findOne({ owner: req.user.id }, "status").lean();
    if (existing?.status === "pending_review") {
      return res.status(400).json({
        message: "Your pocket is under review. Wait for the result before saving new code.",
      });
    }
    const pocket = await Pocket.findOneAndUpdate(
      { owner: req.user.id },
      {
        $set: { brandName: brandName.trim(), tagline: tagline?.trim() ?? "", sourceCode, status: "draft", reviewNote: null },
        $setOnInsert: { owner: req.user.id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json({ message: "Pocket saved", pocket });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Pocket already exists for this account" });
    console.error("upsertPocket:", err);
    return res.status(500).json({ message: "Failed to save pocket" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/pockets/submit
───────────────────────────────────────────────────────────────────────────── */
export const submitForReview = async (req, res) => {
  try {
    const pocket = await Pocket.findOne({ owner: req.user.id });
    if (!pocket) return res.status(404).json({ message: "No pocket found. Save a draft first." });
    if (pocket.status === "pending_review") return res.status(400).json({ message: "Already under review." });
    if (!["draft", "rejected", "live"].includes(pocket.status)) {
      return res.status(400).json({ message: "Save new code before resubmitting." });
    }
    pocket.status     = "pending_review";
    pocket.reviewNote = null;
    await pocket.save();
    return res.status(200).json({ message: "Submitted for review", pocket });
  } catch (err) {
    console.error("submitForReview:", err);
    return res.status(500).json({ message: "Failed to submit" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/pockets/:pocketId/review   (admin only)
   Body: { action: "approve" | "reject", note?: string }

   On approve:
   - Bundle is uploaded to a VERSIONED S3 key (includes a timestamp) so
     CloudFront never serves a stale response — no invalidation needed.
   - PocketFeedEntry is UPSERTED (one per Pocket) so only a single entry
     ever appears in the feed. likesCount and commentsCount are reset to 0
     on every approval because each content update is treated as a fresh post.
───────────────────────────────────────────────────────────────────────────── */
export const reviewPocket = async (req, res) => {
  try {
    const { action, note } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
    }
    const pocket = await Pocket.findById(req.params.pocketId);
    if (!pocket) return res.status(404).json({ message: "Pocket not found" });
    if (pocket.status !== "pending_review") {
      return res.status(400).json({ message: "Pocket is not pending review" });
    }

    // ── Reject ──────────────────────────────────────────────────────────────
    if (action === "reject") {
      pocket.status     = "rejected";
      pocket.reviewNote = note ?? null;
      await pocket.save();
      return res.status(200).json({ message: "Rejected", pocket });
    }

    // ── Approve ─────────────────────────────────────────────────────────────
    let compiledCode;
    try {
      compiledCode = await compilePocketBundle(pocket.sourceCode);
    } catch (compileErr) {
      pocket.status     = "rejected";
      pocket.reviewNote = `Compilation failed: ${compileErr.message}`;
      await pocket.save();
      return res.status(422).json({ message: "Compilation failed", error: compileErr.message });
    }

    // Remember the old bundle URL so we can delete it after the new one is live
    const oldBundleUrl = pocket.compiledBundleUrl ?? null;

    // Versioned key — timestamp makes it unique so CloudFront always fetches
    // a fresh object. The old versioned key is deleted below after success.
    const version   = Date.now();
    const s3Key     = `pockets/${pocket._id}/bundle-${version}.js`;
    const bundleUrl = await uploadBundleToCDN(compiledCode, s3Key);

    pocket.status            = "live";
    pocket.compiledBundleUrl = bundleUrl;
    pocket.reviewNote        = null;
    await pocket.save();

    // Immediately delete the previous bundle from S3 now that the new one is live.
    if (oldBundleUrl) {
      const CDN_BASE = process.env.GAMES_STORAGE_PRIVATE_CLOUDFRONT;
      const oldKey   = CDN_BASE ? oldBundleUrl.replace(`${CDN_BASE}/`, "") : null;
      if (oldKey) await deleteBundleFromCDN(oldKey);
    }

    // Upsert a SINGLE PocketFeedEntry per Pocket.
    // $set refreshes all denormalised fields + compiledBundleUrl.
    // $setOnInsert only fires on the very first approval (creates the doc).
    // Using { new: true } so we can return the entry id if needed.
    await PocketFeedEntry.findOneAndUpdate(
      { pocket: pocket._id },
      {
        $set: {
          owner:             pocket.owner,
          brandName:         pocket.brandName,
          tagline:           pocket.tagline,
          compiledBundleUrl: bundleUrl,
          // Reset engagement on every approval — each update is a fresh post
          likesCount:        0,
          commentsCount:     0,
        },
        $setOnInsert: {
          pocket: pocket._id,
        },
      },
      { upsert: true, new: true, timestamps: true }
    );

    return res.status(200).json({ message: "Approved and published", pocket });
  } catch (err) {
    console.error("reviewPocket:", err);
    return res.status(500).json({ message: "Review failed" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/pockets/entries/:entryId/analytics
───────────────────────────────────────────────────────────────────────────── */
export const trackAnalytics = async (req, res) => {
  try {
    const { event, seconds } = req.body;
    const entry = await PocketFeedEntry.findById(req.params.entryId).select("pocket").lean();
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    const inc = {};
    if (event === "impression") inc["analytics.impressions"]            = 1;
    if (event === "click")      inc["analytics.clicks"]                 = 1;
    if (event === "engagement" && typeof seconds === "number") {
      inc["analytics.totalEngagementSeconds"] = Math.max(0, Math.floor(seconds));
    }
    if (Object.keys(inc).length) {
      await Pocket.findByIdAndUpdate(entry.pocket, { $inc: inc });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("trackAnalytics:", err);
    return res.status(500).json({ message: "Analytics error" });
  }
};