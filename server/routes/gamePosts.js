/**
 * routes/gamePosts.js
 *
 * All routes for the draft → payment → publish pipeline.
 *
 * Route map
 * ─────────────────────────────────────────────────────────────
 * POST   /game-posts/draft                  create or update draft metadata
 * POST   /game-posts/draft/:draftId/build   mark build uploaded, update file meta
 * POST   /game-posts/draft/:draftId/video   mark video uploaded (optional)
 * POST   /game-posts/create-payment-order   create Razorpay order
 * POST   /game-posts/verify-payment         verify signature → queue publish job
 * POST   /game-posts/draft/:draftId/publish-test admin: publish test upload
 * POST   /game-posts/retry-publish/:draftId admin: retry failed publish
 * GET    /game-posts/draft/:draftId         poll draft status
 * ─────────────────────────────────────────────────────────────
 */

import express from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import mongoose from "mongoose";

import verifyToken from "../middlewares/authMiddleware.js";
import requireAdmin from "../middlewares/adminMiddleware.js";
import GamePostDraft from "../models/GamePostDraft.js";
import CreditPurchase from "../models/CreditPurchase.js";
import CreditAudit from "../models/CreditAudit.js";
import AllPost from "../models/Allposts.js";
import { publishGameQueue } from "../queues/publishGameQueue.js";
import { gameSnapshotQueue } from "../queues/gameSnapshotQueue.js";
import { onPostCreated } from "../services/gorse.hooks.js";
import { videoProcessingQueue } from "../queues/videoQueue.js";
import {
  processRazorpayPayment,
} from "../services/razorpay/processPayment.js"; 
import GameSessionRequest from "../models/GameSessionRequest.js";
import DemoConsumption from "../models/DemoConsumption.js";
import { sendEventToQueue } from "../utils/sendEventToQueue.js";
import PostAnalytics from "../models/postAnalytics.js";
import { deleteDraftAndAssets } from "../services/deletePost.js";
import { GAME_SNAPSHOT_SOURCE_REGION, GAME_SNAPSHOT_REGIONS } from "../config/gameSnapshotConfig.js";

const router = express.Router();

// ── Razorpay client (lazy-initialised so tests don't need env vars) ──────────
let razorpay;
function getRazorpay() {
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Derive buildType from file name (matches frontend logic). */
function buildTypeFromFileName(fileName) {
  return fileName.toLowerCase().endsWith(".exe") ? "executable" : "archive";
}

/** Derive format from file extension. */
function formatFromFileName(fileName) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "7z") return "7z";
  if (ext === "zip") return "zip";
  return "exe";
}

/**
 * Core publish transaction.
 * Runs inside a Mongo session; caller must pass the session.
 * Returns the created AllPost document.
 */
async function runPublishTransaction(draft, creditPurchase, session) {
  console.log(`Running publish transaction for draft ${draft._id}`);
  
  const isTestUploadFlow = draft.game.isTestUpload === true;
const isSponsoredFlow =
  !isTestUploadFlow &&
  draft.game.sponsorship.enabled &&
  draft.game.sponsorship.status === "approved";
  const startCredits = isSponsoredFlow ? draft.game.sponsorship.initialCredits : draft.selectedCredits;
  const buildType =
    draft.game.buildType ??
    (draft.buildFile.format === "exe"
      ? "executable"
      : "archive");
      
  console.log("Creating AllPost in public transaction");
  // 1. Create AllPost
  const [post] = await AllPost.create(
    [
      {
        user: draft.creator,
        description: draft.description,
        type: "game_post",
        gamePost: {
          gameName: draft.game.gameName,
          isTestUpload: isTestUploadFlow,
          version: draft.game.version,
          platform: "windows",
          buildType: buildType,
          startPath: draft.game.startPath,
          engine: draft.game.engine,
          steamUrl: draft.game.steamUrl,
          runMode: "sandboxed",
          maxSessionDurationMinutes: draft.game.maxSessionDurationMinutes,
          price: 0, // price is credit-based; set to 0
          file: draft.buildFile,
          sponsorship: {
            enabled: isSponsoredFlow,
            initialCredits: isSponsoredFlow
              ? draft.game.sponsorship.initialCredits
              : 0,
            sponsoredBy:
              draft.game.sponsorship.reviewedBy,
            sponsoredAt:
              draft.game.sponsorship.reviewedAt,
            notes:
              draft.game.sponsorship.notes,
          },
          videoDemo: draft.videoDemo ? {
            name: draft.videoDemo.name,
            key: draft.videoDemo.key,
            url: draft.videoDemo.url,
            size: draft.videoDemo.size,
            optimizedKey: draft.videoDemo.optimizedKey,
            optimizedUrl: draft.videoDemo.optimizedUrl,
            thumbnailUrl: draft.videoDemo.thumbnailUrl,
            processingStatus: draft.videoDemo.processingStatus || "pending",
            processingError: draft.videoDemo.processingError,
            processedAt: draft.videoDemo.processedAt,
          } : null,
          creditBudget: {
            purchasedCredits: isTestUploadFlow || isSponsoredFlow ? 0 : startCredits,
            giftedCredits: isTestUploadFlow ? 0 : (isSponsoredFlow ? startCredits : 0),
            deductedCredits: 0,
            usedCredits: 0,
            remainingCredits: isTestUploadFlow ? 0 : startCredits,
            status: "active",
            lastCreditAddedAt: new Date(),
          },
          snapshot: {
            status: "pending",

            sourceRegion:
              GAME_SNAPSHOT_SOURCE_REGION,

            sourceSnapshotId: null,

            sourceVolumeId: null,

            regions: GAME_SNAPSHOT_REGIONS.map(
              (region) => ({
                region,
                snapshotId: null,
                status: "pending",
                error: null,
                createdAt: null,
                completedAt: null,
              })
            ),

            error: null,

            createdAt: new Date(),

            completedAt: null,
          },
          verification: {
            status: "pending",
            error: null,
            verifiedAt: null,
          },
          visibility: "active",
          gameMetrics: {
            totalSessions: 0,
            totalSessionTimeMs: 0,
            uniquePlayers: 0,
            sessionRequests: 0,
          },
        },
      },
    ],
    { session }
  );

  // 2. Create CreditAudit entry (purchase action) - skip for test uploads
  if (!isTestUploadFlow) {
    await CreditAudit.create(
      [
        {
          gamePost: post._id,
          creator: draft.creator,
          admin: isSponsoredFlow ? draft.game.sponsorship.reviewedBy : null,
          action: isSponsoredFlow ? "gift" : "purchase",
          credits: startCredits,
          previousBalance: 0,
          newBalance: startCredits,
          reason: isSponsoredFlow ? "Admin sponsored game post" : "Initial credit purchase at publish",
          metadata: creditPurchase ? {
            paymentId: creditPurchase.paymentId,
            invoiceId: creditPurchase.invoiceId ?? null,
          } : {},
        },
      ],
      { session }
    );
  }

  // 3. Update CreditPurchase: link to post, mark fulfilled
  if (creditPurchase && !isSponsoredFlow && !isTestUploadFlow) {
    await CreditPurchase.updateOne(
      { _id: creditPurchase._id },
      {
        $set: { gamePost: post._id, fulfillmentStatus: "fulfilled" },
        $inc: { fulfillmentAttempts: 1 },
      },
      { session }
    );
  }

  // 4. Update draft: mark published, link AllPost
  await GamePostDraft.updateOne(
    { _id: draft._id },
    {
      $set: {
        status: "published",
        fulfillmentStatus: "fulfilled",
        allPostId: post._id,
      },
    },
    { session }
  );

  return post;
}


/**
 * Publish job — runs the Mongo transaction.
 * Called by setImmediate (or BullMQ worker).
 *
 * @param {ObjectId|string} draftId
 * @param {ObjectId|string} creditPurchaseId
 */
export async function runPublishJob(draftId, creditPurchaseId) {
  console.log(`Publishing draft in runPublishJob: ${draftId}`);
  const lockedDraft = await GamePostDraft.findOneAndUpdate(
    {
      _id: draftId,
      status: {
        $in: ["payment_completed", "failed"],
      },
    },
    {
      $set: {
        status: "publishing",
        fulfillmentStatus: "processing",
        failureReason: null,
      },
    },
    {
      new: true,
    }
  );

  if (!lockedDraft) {
    console.log(`Draft ${draftId} already processing`);
    return;
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let creditPurchase = null;

    // Paid publish only
    if (creditPurchaseId) {
      await CreditPurchase.updateOne(
        { _id: creditPurchaseId },
        {
          $set: {
            fulfillmentStatus: "processing",
          },
          $inc: {
            fulfillmentAttempts: 1,
          },
        },
        { session }
      );

      creditPurchase = await CreditPurchase.findById(
        creditPurchaseId
      ).session(session);

      if (!creditPurchase) {
        throw new Error("CreditPurchase not found");
      }
    }

    const draft = await GamePostDraft.findById(draftId).session(session);

    if (!draft) {
      throw new Error("Draft not found inside transaction");
    }

    // Paid games require a CreditPurchase.
    // Sponsored and Test games do not.
    if (!draft.game.sponsorship.enabled && !draft.game.isTestUpload && !creditPurchase) {
      throw new Error(
        "Paid publish requires a CreditPurchase"
      );
    }

    const post = await runPublishTransaction(
      draft,
      creditPurchase,
      session
    );

    await session.commitTransaction();

    console.log(
      "[GORSE] Publishing game post:",
      post._id.toString()
    );

    onPostCreated(post);

    // ─────────────────────────────────────────────
    // Queue game snapshot preparation
    // ─────────────────────────────────────────────

await gameSnapshotQueue.add(
  "prepareGameSnapshot",
  {
    gamePostId: post._id.toString(),

    gameId: post.gamePost.gameName,

    buildId: post._id.toString(),
    startPath: post.gamePost.startPath,

    s3Key: post.gamePost.file.key,
    s3Url: post.gamePost.file.url,

    format: post.gamePost.file.format,
    buildSize: post.gamePost.file.size,

    sourceRegion: GAME_SNAPSHOT_SOURCE_REGION,
    targetRegions: GAME_SNAPSHOT_REGIONS,
  },
  {
    jobId: `snapshot-${post._id}`,
    attempts: 3,

    backoff: {
      type: "exponential",
      delay: 10000,
    },

    removeOnComplete: 500,
    removeOnFail: 500,
  }
);

    console.log(
      `[publishJob] Snapshot preparation queued for game post ${post._id}`
    );

    console.log(
      `[publishJob] Game post published for draft ${draftId}`
    );

} catch (err) {
  await session.abortTransaction();

  console.error(
    `[publishJob] Transaction failed for draft ${draftId}:`,
    err
  );

  await GamePostDraft.updateOne(
    { _id: draftId },
    {
      $set: {
        status: "failed",
        fulfillmentStatus: "failed",
        failureReason: err.message,
      },
    }
  );

  if (creditPurchaseId) {
    await CreditPurchase.updateOne(
      { _id: creditPurchaseId },
      {
        $set: {
          fulfillmentStatus: "failed",
          fulfillmentError: err.message,
        },
      }
    );
  }

  throw err;
} finally {
    await session.endSession();
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /game-posts/draft
 * Create (or upsert) a draft with game metadata.
 * Called when the user first opens the form or changes metadata.
 */
router.post("/draft", verifyToken, async (req, res) => {
  try {
    const { draftId, description, game } = req.body;
    const duration = Number(game?.maxSessionDurationMinutes);

    game.maxSessionDurationMinutes =
      Number.isInteger(duration) && duration >= 1 && duration <= 120
        ? duration
        : 10;

    // Admin validation for test upload
    const isTestReq = game?.isTestUpload === true || game?.testUpload?.enabled === true;
    if (isTestReq && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Only admins can create test uploads." });
    }

    let draft;
    if (draftId) {
      // Update existing draft (must belong to caller)
      draft = await GamePostDraft.findOne({
        _id: draftId,
        creator: req.user._id,
        status: {
          $in: ["draft", "uploading", "ready_for_payment"]
        }
      });

      if (!draft) {
        return res.status(404).json({
          message: "Draft not found or not editable"
        });
      }

      draft.description = description;
      draft.game.gameName = game.gameName ?? draft.game.gameName;
      draft.game.isTestUpload = isTestReq;
      draft.game.version = game.version ?? draft.game.version;
      draft.game.platform = "windows";
      draft.game.startPath = game.startPath ?? draft.game.startPath;
      draft.game.engine = game.engine ?? draft.game.engine;
      draft.game.steamUrl = game.steamUrl ?? draft.game.steamUrl;
      draft.game.runMode = game.runMode ?? draft.game.runMode;
      draft.game.buildType = game.buildType ?? draft.game.buildType;
      draft.game.maxSessionDurationMinutes =
        game.maxSessionDurationMinutes ??
        draft.game.maxSessionDurationMinutes;

      await draft.save();
    } else {
      console.log("Creating new draft");
      draft = new GamePostDraft({
        creator: req.user._id,
        description,
      });

      draft.game.gameName = game.gameName;
      draft.game.isTestUpload = isTestReq;
      draft.game.version = game.version;
      draft.game.platform = "windows";
      draft.game.startPath = game.startPath;
      draft.game.engine = game.engine;
      draft.game.steamUrl = game.steamUrl;
      draft.game.runMode = game.runMode;
      draft.game.maxSessionDurationMinutes =
        game.maxSessionDurationMinutes;

      await draft.save();
    }

    res.json({ draftId: draft._id, status: draft.status });
  } catch (err) {
    console.error("draft create/update error:", err);
    res.status(500).json({ message: "Failed to save draft" });
  }
});

/**
 * POST /game-posts/draft/:draftId/build
 * Called by the frontend after the game build upload completes.
 * Stores S3 metadata in the draft and advances status if video is also done
 * (or not required).
 */
router.post("/draft/:draftId/build", verifyToken, async (req, res) => {
  try {
    const { name, key, url, size } = req.body;
    if (!name || !key || !url || !size) {
      return res.status(400).json({ message: "Missing file metadata" });
    }

    const buildType = buildTypeFromFileName(name);
    const format = formatFromFileName(name);

    const draft = await GamePostDraft.findOneAndUpdate(
      {
        _id: req.params.draftId,
        creator: req.user._id,
        status: {
          $in: [
            "draft",
            "uploading",
            "ready_for_payment",
          ],
        },
      },
      {
        $set: {
          buildFile: { name, key, url, size, format, uploadedAt: new Date() },
          "game.buildType": buildType,
          "game.platform": "windows",
          status: "uploading",
        },
      },
      { new: true }
    );
    if (!draft) return res.status(404).json({ message: "Draft not found" });

    res.json({ draftId: draft._id, status: draft.status });
  } catch (err) {
    console.error("draft build update error:", err);
    res.status(500).json({ message: "Failed to update build metadata" });
  }
});

/**
 * POST /game-posts/draft/:draftId/video
 * Called after optional gameplay trailer upload completes.
 */
router.post("/draft/:draftId/video", verifyToken, async (req, res) => {
  try {
    const { name, key, url, size } = req.body;

    const draft = await GamePostDraft.findOneAndUpdate(
      {
        _id: req.params.draftId,
        creator: req.user._id,
        status: {
          $in: ["draft", "uploading", "ready_for_payment"],
        },
      },
      {
        $set: {
          videoDemo: {
            name,
            key,
            url,
            size,
            processingStatus: "pending", // Trigger loading state on frontend
            uploadedAt: new Date()
          }
        }
      },
      { new: true }
    );
    if (!draft) return res.status(404).json({ message: "Draft not found" });

    // 🚀 Dispatch to FFmpeg Worker
    await videoProcessingQueue.add('optimize-video', {
      key: key,
      url: url,
      entityType: 'game',
      entityId: draft._id.toString()
    }, {
      removeOnComplete: true,
      attempts: 3
    });

    res.json({ draftId: draft._id, status: draft.status });
  } catch (err) {
    console.error("draft video update error:", err);
    res.status(500).json({ message: "Failed to update video metadata" });
  }
});

/**
 * POST /game-posts/draft/:draftId/ready
 * Frontend calls this after uploads finish to advance status to ready_for_payment.
 */
router.post("/draft/:draftId/ready", verifyToken, async (req, res) => {
  try {
    const draft = await GamePostDraft.findOne({
      _id: req.params.draftId,
      creator: req.user._id,
    });
    if (!draft) return res.status(404).json({ message: "Draft not found" });

    // Validate required fields
    if (!draft.buildFile?.key) {
      return res.status(400).json({ message: "Game build must be uploaded before proceeding" });
    }
    if (!draft.game?.gameName) {
      return res.status(400).json({ message: "Game name is required" });
    }
    if (!draft.game?.startPath) {
      return res.status(400).json({ message: "Start path is required" });
    }


    draft.status = "ready_for_payment";
    await draft.save();

    res.json({ draftId: draft._id, status: draft.status });
  } catch (err) {
    console.error("draft ready error:", err);
    res.status(500).json({ message: "Failed to advance draft status" });
  }
});

/**
 * POST /game-posts/create-payment-order
 * Validates draft, creates Razorpay order, advances draft to payment_pending.
 *
 * Body: { draftId, selectedCredits }
 */
router.post("/create-payment-order", verifyToken, async (req, res) => {
  try {
    const { draftId, selectedCredits } = req.body;

    // Minimum $100 -> 4000 credits
    if (!draftId || !selectedCredits || selectedCredits < 4000) {
      return res.status(400).json({ message: "Invalid request: draftId and selectedCredits (min 4000 = $100) required" });
    }

    const draft = await GamePostDraft.findOne({
      _id: draftId,
      creator: req.user._id,
    });

    if (!draft) return res.status(404).json({ message: "Draft not found" });

    if (draft.game.isTestUpload) {
      return res.status(400).json({ message: "Test uploads do not require payment." });
    }

    if (draft.status === "payment_pending" && draft.razorpayOrderId) {
      return res.json({
        orderId: draft.razorpayOrderId,
        amount: draft.amount,
        currency: draft.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        draftId: draft._id,
      });
    }

    if (draft.status !== "ready_for_payment") {
      return res.status(409).json({
        message: `Draft is in status '${draft.status}' and cannot be paid for`,
      });
    }

    if (!draft.buildFile?.key) {
      return res.status(400).json({ message: "Game build must be uploaded before payment" });
    }

    // $1 = 40 credits
    // Total Dollars = selectedCredits / 40
    // Total Cents = (selectedCredits / 40) * 100
    const amount = Math.round((selectedCredits / 40) * 100);

    // Create Razorpay order
    const order = await getRazorpay().orders.create({
      amount: amount,
      currency: draft.currency || "USD",
      receipt: `draft_${draft._id}`,
      notes: {
        draftId: String(draft._id),
        userId: String(req.user._id),
        credits: String(selectedCredits),
      },
    });

    // Persist order details on draft
    draft.selectedCredits = selectedCredits;
    draft.amount = amount;
    draft.currency = draft.currency || "USD";
    draft.razorpayOrderId = order.id;
    draft.status = "payment_pending";
    await draft.save();

    res.json({
      orderId: order.id,
      amount: amount,
      currency: draft.currency || "USD",
      keyId: process.env.RAZORPAY_KEY_ID,
      draftId: draft._id,
    });
  } catch (err) {
    console.error("create-payment-order error:", err);
    res.status(500).json({ message: "Failed to create payment order" });
  }
});

/**
 * POST /game-posts/verify-payment
 * Verifies Razorpay signature → creates CreditPurchase → queues publish job.
 *
 * Body: { draftId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
 */
router.post(
  "/verify-payment",
  verifyToken,
  async (req, res) => {
    try {
      const {
        draftId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      } = req.body;

      const draft = await GamePostDraft.findById(draftId);
      if (draft && draft.game.isTestUpload) {
        return res.status(400).json({ message: "Test uploads do not require payment." });
      }

      const expected =
        crypto
          .createHmac(
            "sha256",
            process.env
              .RAZORPAY_KEY_SECRET
          )
          .update(
            `${razorpayOrderId}|${razorpayPaymentId}`
          )
          .digest("hex");

      if (
        expected !==
        razorpaySignature
      ) {
        return res
          .status(400)
          .json({
            message:
              "Payment signature verification failed",
          });
      }

      await processRazorpayPayment(
        razorpayPaymentId
      );

      res.json({
        message:
          "Payment verified. Publishing your game…",
        draftId,
        status:
          "payment_completed",
      });
    } catch (err) {
      console.error(
        "verify-payment",
        err
      );

      res
        .status(500)
        .json({
          message:
            "Payment verification failed",
        });
    }
  }
);


/**
 * POST /game-posts/draft/:draftId/publish-test
 * TEST UPLOAD PUBLISH ENDPOINT
 * Bypasses Razorpay entirely if the draft is marked as a test upload.
 */
router.post("/draft/:draftId/publish-test", verifyToken, requireAdmin, async (req, res) => {
  try {
    const draft = await GamePostDraft.findOne({ _id: req.params.draftId, creator: req.user._id });
    if (!draft) return res.status(404).json({ message: "Draft not found" });

    if (!draft.game.isTestUpload) {
      return res.status(400).json({ message: "Draft is not marked as a test upload" });
    }
    if (draft.status !== "ready_for_payment") {
      return res.status(409).json({ message: "Draft uploads must be finished before publishing" });
    }

    draft.status = "payment_completed"; // Sets status so runPublishJob picks it up
    await draft.save();

    // Queue publish job natively without a creditPurchaseId
    await publishGameQueue.add("publishGame", { draftId: draft._id.toString() }, { attempts: 1 });

    res.json({ message: "Publishing test game…", draftId: draft._id, status: "payment_completed" });
  } catch (err) {
    res.status(500).json({ message: "Failed to publish test game" });
  }
});

/**
 * POST /game-posts/retry-publish/:draftId
 * Admin endpoint: retry a failed publish job.
 */
router.post("/retry-publish/:draftId", verifyToken, requireAdmin, async (req, res) => {
  try {
    const draft = await GamePostDraft.findOne({
      _id: req.params.draftId,
      status: "failed",
    });
    if (!draft) return res.status(404).json({ message: "Failed draft not found" });

    if (draft.game.sponsorship.enabled) {
      await publishGameQueue.add("publishGame", { draftId: draft._id.toString() }, { attempts: 5, backoff: { type: "exponential", delay: 10000 } });
      return res.json({ message: "Publish retry queued for Sponsored Game", draftId: draft._id });
    }

    if (draft.game.isTestUpload) {
      await publishGameQueue.add("publishGame", { draftId: draft._id.toString() }, { attempts: 5, backoff: { type: "exponential", delay: 10000 } });
      return res.json({ message: "Publish retry queued for Test Upload", draftId: draft._id });
    }

    const creditPurchase = await CreditPurchase.findOne({
      _id: draft.creditPurchaseId,
      status: "completed",
      fulfillmentStatus: "failed",
    });
    if (!creditPurchase) {
      return res.status(409).json({ message: "No retryable CreditPurchase found for this draft" });
    }

    await publishGameQueue.add(
      "publishGame",
      {
        draftId: draft._id.toString(),
        creditPurchaseId: creditPurchase._id.toString(),
      },
      {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 10000,
        },
        removeOnComplete: 500,
        removeOnFail: 500,
      }
    );

    res.json({ message: "Publish retry queued", draftId: draft._id });
  } catch (err) {
    console.error("retry-publish error:", err);
    res.status(500).json({ message: "Failed to queue retry" });
  }
});

/**
 * GET /game-posts/draft/:draftId
 * Frontend polls this to check publish progress.
 */
router.get(
  "/draft/:draftId",
  verifyToken,
  async (req, res) => {
    console.log(`Fetching draft ${req.params.draftId} for user ${req.user._id}`);
    const draft =
      await GamePostDraft.findOne({
        _id: req.params.draftId,
        creator: req.user._id,
      });

    console.log("Draft found:", !!draft, draft ? `status=${draft.status}` : "");

    if (!draft) {
      return res
        .status(404)
        .json({
          message:
            "Draft not found",
        });
    }

    res.json({
      draftId: draft._id,
      description:
        draft.description,
      game: draft.game,
      buildFile:
        draft.buildFile,
      videoDemo:
        draft.videoDemo,
      selectedCredits:
        draft.selectedCredits,
      amount: draft.amount,
      currency:
        draft.currency,
      status: draft.status,
      failureReason:
        draft.failureReason,
      isSponsored: draft.game.sponsorship.enabled,
      sponsoredCredits: draft.game.sponsorship.initialCredits,
      approvalStatus: draft.game.sponsorship.status,
    });
  }
);


router.get(
  "/my-active-draft",
  verifyToken,
  async (req, res) => {
    const draft =
      await GamePostDraft.findOne({
        creator: req.user._id,
        status: {
          $nin: ["published"]
        }
      }).sort({
        updatedAt: -1
      });

    console.log(draft);

    res.json(draft);
  }
);

router.delete("/draft/:draftId", verifyToken, async (req, res) => {
  try {
    const draft = await GamePostDraft.findOne({
      _id: req.params.draftId,
      creator: req.user._id,
      status: {
        $in: ["draft", "uploading", "ready_for_payment"],
      },
    });

    if (!draft) {
      return res.status(404).json({ message: "Draft not found" });
    }

    // Respond immediately
    res.json({ message: "Draft deleted" });

    // Cleanup in background
    deleteDraftAndAssets(draft).catch((err) =>
      console.error("Draft cleanup failed:", err)
    );
  } catch (err) {
    console.error("delete draft error:", err);
    res.status(500).json({ message: "Failed to delete draft" });
  }
});

/**
 * SPONSORED PUBLISH ENDPOINT
 * Bypasses Razorpay entirely if the draft is approved and sponsored.
 */
router.post("/draft/:draftId/publish-sponsored", verifyToken, async (req, res) => {
  try {
    const draft = await GamePostDraft.findOne({ _id: req.params.draftId, creator: req.user._id });
    if (!draft) return res.status(404).json({ message: "Draft not found" });

    if (draft.game.sponsorship.status !== "approved" || !draft.game.sponsorship.enabled) {
      return res.status(403).json({ message: "Draft is not sponsored or approved by Admin" });
    }
    if (draft.status !== "ready_for_payment") {
      return res.status(409).json({ message: "Draft uploads must be finished before publishing" });
    }

    draft.status = "payment_completed"; // Sets status so runPublishJob picks it up
    await draft.save();

    // Queue publish job natively without a creditPurchaseId
    await publishGameQueue.add("publishGame", { draftId: draft._id.toString() }, { attempts: 1 });

    res.json({ message: "Publishing sponsored game…", draftId: draft._id, status: "payment_completed" });
  } catch (err) {
    res.status(500).json({ message: "Failed to publish sponsored game" });
  }
});



router.post("/:postId/create-repurchase-order", verifyToken, async (req, res) => {
  try {
    const { selectedCredits } = req.body;

    if (!selectedCredits || selectedCredits < 4000) {
      return res.status(400).json({ message: "Minimum 4000 credits required" });
    }

    const post = await AllPost.findOne({
      _id: req.params.postId,
      user: req.user._id,
      type: "game_post"
    });

    if (!post) {
      return res.status(404).json({ message: "Game post not found or unauthorized" });
    }

    if (post.gamePost.isTestUpload) {
      return res.status(400).json({ message: "Repurchase is not available for test uploads." });
    }

    const amount = Math.round((selectedCredits / 40) * 100);

    const order = await getRazorpay().orders.create({
      amount: amount,
      currency: "USD",
      receipt: `r_${post._id}_${crypto.randomBytes(4).toString("hex")}`,
      notes: {
        postId: String(post._id),
        userId: String(req.user._id),
        credits: String(selectedCredits),
        isRepurchase: "true"
      },
    });

    res.json({
      orderId: order.id,
      amount: amount,
      currency: "USD",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("create-repurchase-order error:", err);
    res.status(500).json({ message: "Failed to create repurchase order" });
  }
});

/**
 * POST /game-posts/:postId/verify-repurchase-payment
 * Verifies Razorpay payment, creates CreditPurchase/CreditAudit, updates game credits via Transaction.
 */
router.post("/:postId/verify-repurchase-payment", verifyToken, async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, selectedCredits } = req.body;

    // 1. Verify Signature
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expected !== razorpaySignature) {
      return res.status(400).json({ message: "Payment signature verification failed" });
    }

    // Capture payment on Razorpay
    const payment = await getRazorpay().payments.fetch(razorpayPaymentId);

    if (payment.status !== "captured") {
      throw new Error("Payment not captured");
    }

    if (payment.amount !== Math.round((selectedCredits / 40) * 100)) {
      throw new Error("Payment amount mismatch");
    }

    // 2. Execute Updates in Transaction
    session.startTransaction();

    const post = await AllPost.findOne({
      _id: req.params.postId,
      user: req.user._id
    }).session(session);

    if (!post) {
      throw new Error("Game post not found during verification");
    }

    if (post.gamePost.isTestUpload) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Repurchase is not available for test uploads." });
    }

    // Create CreditPurchase explicitly linked to the post
    const [creditPurchase] = await CreditPurchase.create(
      [{
          creator: req.user._id,
          gamePost: post._id,
          draft: null,
          creditsPurchased: selectedCredits,
          amountPaid: Math.round((selectedCredits / 40) * 100),
          currency: "USD",
          paymentProvider: "razorpay",
          razorpayOrderId,
          paymentId: razorpayPaymentId,
          status: "completed",
          fulfillmentStatus: "fulfilled",
          fulfillmentAttempts: 1,
        },
      ],
      { session }
    );

    // Create CreditAudit entry
    await CreditAudit.create([{
      gamePost: post._id,
      creator: req.user._id,
      action: "purchase",
      credits: selectedCredits,
      previousBalance: post.gamePost.creditBudget.remainingCredits,
      newBalance: post.gamePost.creditBudget.remainingCredits + selectedCredits,
      reason: "Credit repurchase",
      metadata: { 
        paymentId: razorpayPaymentId,
        purchaseId: creditPurchase._id
      }
    }], { session });

    // Build update operations
    const updateOps = {
      $inc: {
        "gamePost.creditBudget.purchasedCredits": selectedCredits,
        "gamePost.creditBudget.remainingCredits": selectedCredits,
      },
      $set: {
        "gamePost.creditBudget.lastCreditAddedAt": new Date(),
      }
    };

    // Reactivate post if it was exhausted
    const isExhausted = post.gamePost.creditBudget.remainingCredits === 0 || post.gamePost.creditBudget.status === "exhausted";
    
    if (isExhausted) {
      updateOps.$set["gamePost.creditBudget.status"] = "active";
      updateOps.$unset = {
        "gamePost.creditBudget.exhaustedAt": "",
        "gamePost.creditBudget.requestWindowEndsAt": ""
      };
    }

    await AllPost.updateOne(
      { _id: post._id },
      updateOps,
      { session }
    );

    const notifiedAt = new Date();

const pendingRequests = await GameSessionRequest.find({
  gamePost: post._id,
  notifiedAt: null,
}).session(session);

await GameSessionRequest.updateMany(
  {
    gamePost: post._id,
    notifiedAt: null,
  },
  {
    $set: { notifiedAt },
  },
  { session }
);

    await session.commitTransaction();

    await Promise.all(
      pendingRequests.map((request) =>
        sendEventToQueue({
          type: "GAME_SESSIONS_AVAILABLE",
          actorId: req.user._id.toString(),
          recipientId: request.requestedBy.toString(),
          postId: post._id.toString(),
        })
      )
    );

    res.json({ 
      message: "Repurchase successful", 
      newRemainingCredits: post.gamePost.creditBudget.remainingCredits + selectedCredits 
    });

  } catch (err) {
    await session.abortTransaction();
    console.error("verify-repurchase-payment error:", err);
    res.status(500).json({ message: "Repurchase verification failed" });
  } finally {
    session.endSession();
  }
});


// Request Sessions

router.post("/:postId/request-session", verifyToken, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { message = "" } = req.body;

    const post = await AllPost.findOne({
      _id: req.params.postId,
      type: "game_post",
    });

    if (!post) {
      return res.status(404).json({
        message: "Game not found.",
      });
    }

    if (post.gamePost.isTestUpload) {
      return res.status(400).json({ message: "Session requests are disabled for test uploads." });
    }

    if (String(post.user) === String(req.user._id)) {
      return res.status(400).json({
        message: "You cannot request sessions for your own game.",
      });
    }

    if (post.gamePost.creditBudget.remainingCredits > 0) {
      return res.status(400).json({
        message: "This game still has available sessions.",
      });
    }

    const alreadyPlayed = await DemoConsumption.exists({
      user: req.user._id,
      post: post._id,
    });

    if (alreadyPlayed) {
      return res.status(400).json({
        message: "You have already played this game.",
      });
    }

    const existing = await GameSessionRequest.findOne({
      gamePost: post._id,
      requestedBy: req.user._id,
    });

    if (existing) {
      return res.status(400).json({
        message: "You have already requested more sessions.",
      });
    }

    session.startTransaction();

    const [request] = await GameSessionRequest.create(
      [
        {
          gamePost: post._id,
          creator: post.user,
          requestedBy: req.user._id,
          message: message.trim(),
        },
      ],
      { session }
    );

    await AllPost.updateOne(
      { _id: post._id },
      {
        $inc: {
          "gamePost.gameMetrics.sessionRequests": 1,
        },
      },
      { session }
    );

    const today = new Date().toISOString().slice(0, 10);

    const result = await PostAnalytics.updateOne(
      { post: post._id },
      {
        $inc: {
          "lifetime.sessionRequests": 1,
          "dailyStats.$[day].sessionRequests": 1,
        },
      },
      {
        session,
        arrayFilters: [{ "day.date": today }],
      }
    );

    if (result.modifiedCount === 0) {
      await PostAnalytics.updateOne(
        { post: post._id },
        {
          $inc: {
            "lifetime.sessionRequests": 1,
          },
          $push: {
            dailyStats: {
              date: today,

              views: 0,
              uniqueViews: 0,
              watchTimeMs: 0,

              likes: 0,
              comments: 0,
              shares: 0,
              saves: 0,

              demoConsumptions: 0,

              sessions: 0,
              sessionPlayTimeMs: 0,
              uniquePlayers: 0,

              sessionRequests: 1,
            },
          },
        },
        { session }
      );
    }

    await session.commitTransaction();
    await session.endSession();

    // Send notification only after the database changes are committed.
    await sendEventToQueue({
      type: "GAME_SESSION_REQUEST",
      actorId: req.user._id.toString(),
      recipientId: post.user.toString(),
      postId: post._id.toString(),
    });

    res.json({
      success: true,
      sessionRequest: {
        hasRequested: true,
        requestedAt: request.createdAt,
        message: request.message,
        notifiedAt: request.notifiedAt,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    await session.endSession();

    console.error(err);

    res.status(500).json({
      message: "Failed to submit request.",
    });
  }
});

router.get("/:postId/request-session/me", verifyToken, async (req, res) => {
  try {
    const request = await GameSessionRequest.findOne({
      gamePost: req.params.postId,
      requestedBy: req.user._id,
    }).select("createdAt message notifiedAt");

    if (!request) {
      return res.json({
        hasRequested: false,
      });
    }

    res.json({
      hasRequested: true,
      requestedAt: request.createdAt,
      message: request.message,
      notifiedAt: request.notifiedAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch request.",
    });
  }
});



export default router;