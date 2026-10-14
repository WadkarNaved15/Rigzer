// controllers/pocket.controller.js
import Pocket          from "../models/Pocket.js";
import PocketFeedEntry from "../models/PocketFeedEntry.js";
import User            from "../models/User.js";
import { compilePocketBundle } from "../services/pocketCompiler.service.js";
import { uploadBundleToCDN, deleteBundleFromCDN } from "../services/pocketCDN.service.js";
import { isHtmlSource, buildHtmlDocument } from "../services/pocketCompiler.service.js";

const POCKET_HEIGHT = 550;

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
    const pockets = await Pocket.find({ status: "pending_review" })
      .populate("owner", "username avatar email")
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(200).json({ pockets });
  } catch (err) {
    console.error("getPendingPockets:", err);
    return res.status(500).json({ message: "Failed to fetch pending pockets" });
  }
};

// GET /api/pockets/mine
export const getMyPockets = async (req, res) => {
  try {
    const pockets = await Pocket.find({ owner: req.user.id })
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(200).json({ pockets });
  } catch (err) {
    console.error("getMyPockets:", err);
    return res.status(500).json({ message: "Failed to fetch pockets" });
  }
};

// GET /api/pockets/:pocketId
export const getPocketById = async (req, res) => {
  try {
    const pocket = await Pocket.findOne({
      _id: req.params.pocketId,
      owner: req.user.id,
    }).lean();

    if (!pocket) {
      return res.status(404).json({ message: "Pocket not found" });
    }
    return res.status(200).json({ pocket });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid Pocket ID" });
    }
    console.error("getPocketById:", err);
    return res.status(500).json({ message: "Failed to fetch Pocket" });
  }
};

// POST /api/pockets — create a new Pocket
export const createPocket = async (req, res) => {
  try {
    const { brandName, tagline = "", sourceCode } = req.body;

    if (!brandName?.trim() || !sourceCode?.trim()) {
      return res.status(400).json({ message: "brandName and sourceCode are required" });
    }

    const pocket = await Pocket.create({
      owner: req.user.id,
      brandName: brandName.trim(),
      tagline: tagline.trim(),
      sourceCode,
      status: "draft",
    });

    return res.status(201).json({ message: "Pocket created", pocket });
  } catch (err) {
    console.error("createPocket:", err);
    return res.status(500).json({ message: "Failed to create Pocket" });
  }
};

// PATCH /api/pockets/:pocketId — update one Pocket
export const updatePocket = async (req, res) => {
  try {
    const { brandName, tagline = "", sourceCode } = req.body;

    if (!brandName?.trim() || !sourceCode?.trim()) {
      return res.status(400).json({ message: "brandName and sourceCode are required" });
    }

    const pocket = await Pocket.findOne({
      _id: req.params.pocketId,
      owner: req.user.id,
    });

    if (!pocket) {
      return res.status(404).json({ message: "Pocket not found" });
    }

    if (pocket.status === "pending_review") {
      return res.status(400).json({ message: "This Pocket is under review and cannot be edited." });
    }

    pocket.brandName  = brandName.trim();
    pocket.tagline    = tagline.trim();
    pocket.sourceCode = sourceCode;
    pocket.status     = "draft";
    pocket.reviewNote = null;

    await pocket.save();

    return res.status(200).json({ message: "Pocket saved", pocket });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid Pocket ID" });
    }
    console.error("updatePocket:", err);
    return res.status(500).json({ message: "Failed to save Pocket" });
  }
};

// POST /api/pockets/:pocketId/submit
export const submitForReview = async (req, res) => {
  try {
    const pocket = await Pocket.findOne({
      _id: req.params.pocketId,
      owner: req.user.id,
    });

    if (!pocket) {
      return res.status(404).json({ message: "Pocket not found" });
    }

    if (pocket.status === "pending_review") {
      return res.status(400).json({ message: "Already under review." });
    }

    if (!["draft", "rejected", "live"].includes(pocket.status)) {
      return res.status(400).json({ message: "Save new code before resubmitting." });
    }

    pocket.status     = "pending_review";
    pocket.reviewNote = null;
    await pocket.save();

    return res.status(200).json({ message: "Submitted for review", pocket });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid Pocket ID" });
    }
    console.error("submitForReview:", err);
    return res.status(500).json({ message: "Failed to submit" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/pockets/:pocketId/review   (admin only)
   Body: { action: "approve" | "reject", note?: string }

   On approve:
   - HTML sources are wrapped with the CSP and uploaded as .html (no Babel).
   - JSX sources are compiled with Babel and uploaded as .js.
   - Bundle goes to a versioned S3 key, so CloudFront never serves stale.
   - PocketFeedEntry is upserted in place (stable _id) with publishedAt = now.
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
    const sourceType = isHtmlSource(pocket.sourceCode) ? "html" : "jsx";
    let payload;

    if (sourceType === "html") {
      payload = buildHtmlDocument(pocket.sourceCode, POCKET_HEIGHT);
    } else {
      try {
        payload = await compilePocketBundle(pocket.sourceCode);
      } catch (compileErr) {
        pocket.status     = "rejected";
        pocket.reviewNote = `Compilation failed: ${compileErr.message}`;
        await pocket.save();
        return res.status(422).json({ message: "Compilation failed", error: compileErr.message });
      }
    }

    // Save old bundle URL so it can be deleted after the new one is live
    const oldBundleUrl = pocket.compiledBundleUrl ?? null;

    const version     = Date.now();
    const ext         = sourceType === "html" ? "html" : "js";
    const contentType = sourceType === "html"
      ? "text/html; charset=utf-8"
      : "application/javascript";
    const s3Key       = `pockets/${pocket._id}/bundle-${version}.${ext}`;

    const bundleUrl = await uploadBundleToCDN(payload, s3Key, contentType);

    pocket.status            = "live";
    pocket.sourceType        = sourceType;
    pocket.compiledBundleUrl = bundleUrl;
    pocket.reviewNote        = null;
    await pocket.save();

    // Upsert the feed entry first, so the feed never points at a deleted bundle.
    const publishedAt = new Date();
    await PocketFeedEntry.findOneAndUpdate(
      { pocket: pocket._id },
      {
        $set: {
          owner:             pocket.owner,
          brandName:         pocket.brandName,
          tagline:           pocket.tagline,
          compiledBundleUrl: bundleUrl,
          sourceType,
          publishedAt,
          likesCount:        0,
          commentsCount:     0,
        },
        $setOnInsert: { pocket: pocket._id },
      },
      { upsert: true, new: true }
    );

    // Delete the old bundle last. A failure here must not fail the approval.
    if (oldBundleUrl) {
      try {
        const CDN_BASE = process.env.GAMES_STORAGE_PRIVATE_CLOUDFRONT;
        const oldKey   = CDN_BASE ? oldBundleUrl.replace(`${CDN_BASE}/`, "") : null;
        if (oldKey) await deleteBundleFromCDN(oldKey);
      } catch (cleanupErr) {
        console.warn("reviewPocket: old bundle cleanup failed:", cleanupErr.message);
      }
    }

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
    if (event === "impression") inc["analytics.impressions"] = 1;
    if (event === "click")      inc["analytics.clicks"]      = 1;
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