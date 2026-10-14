// routes/pocket.routes.js
import express from "express";
import multer from "multer";

import verifyToken from "../middlewares/authMiddleware.js";
import requireAdmin from "../middlewares/adminMiddleware.js";
import requirePocketEligible from "../middlewares/pocketEligibleMiddleware.js";

import {
  getMyPockets,
  getPocketById,
  createPocket,
  updatePocket,
  submitForReview,
  reviewPocket,
  trackAnalytics,
  setPocketEligibility,
  getPendingPockets,
} from "../controllers/pocket.controller.js";

import {
  uploadPocketMedia,
  deletePocketMedia,
  listPocketMedia,
} from "../controllers/pocketMedia.controller.js";

// Memory storage — buffers are passed directly to S3.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB per file
    files: 10,
  },
});

const router = express.Router();

// ── CORS preflight ───────────────────────────────────────────────────────────
router.options("*", (req, res) => res.sendStatus(204));

// ── Admin ────────────────────────────────────────────────────────────────────
router.get(
  "/pending",
  verifyToken,
  requireAdmin,
  getPendingPockets
);

router.post(
  "/eligibility/:userId",
  verifyToken,
  requireAdmin,
  setPocketEligibility
);

router.post(
  "/:pocketId/review",
  verifyToken,
  requireAdmin,
  reviewPocket
);

// ── Creator — Pocket CRUD ────────────────────────────────────────────────────

// List all Pockets belonging to the authenticated user.
router.get(
  "/mine",
  verifyToken,
  requirePocketEligible,
  getMyPockets
);

// Create a new Pocket.
router.post(
  "/",
  verifyToken,
  requirePocketEligible,
  createPocket
);

// Get one Pocket owned by the authenticated user.
router.get(
  "/:pocketId",
  verifyToken,
  requirePocketEligible,
  getPocketById
);

// Update one specific Pocket.
router.patch(
  "/:pocketId",
  verifyToken,
  requirePocketEligible,
  updatePocket
);

// Submit one specific Pocket for review.
router.post(
  "/:pocketId/submit",
  verifyToken,
  requirePocketEligible,
  submitForReview
);

// ── Creator — Pocket-specific media library ──────────────────────────────────

// List media for a specific Pocket.
router.get(
  "/:pocketId/media",
  verifyToken,
  requirePocketEligible,
  listPocketMedia
);

// Upload media for a specific Pocket.
router.post(
  "/:pocketId/media/upload",
  verifyToken,
  requirePocketEligible,
  (req, res, next) => {
    upload.array("files", 10)(req, res, (err) => {
      if (err?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "File exceeds 30 MB limit.",
        });
      }

      if (err?.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          message: "Maximum 10 files per upload.",
        });
      }

      if (err) {
        return res.status(400).json({
          message: err.message,
        });
      }

      next();
    });
  },
  uploadPocketMedia
);

// Delete media from a specific Pocket.
router.delete(
  "/:pocketId/media",
  verifyToken,
  requirePocketEligible,
  deletePocketMedia
);

// ── Analytics — any logged-in user ───────────────────────────────────────────
router.post(
  "/entries/:entryId/analytics",
  verifyToken,
  trackAnalytics
);

export default router;
