// routes/pocket.routes.js
import express               from "express";
import multer                from "multer";
import verifyToken           from "../middlewares/authMiddleware.js";
import requireAdmin          from "../middlewares/adminMiddleware.js";
import requirePocketEligible from "../middlewares/pocketEligibleMiddleware.js";
import {
  getMyPocket,
  upsertPocket,
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

// Memory storage — buffer passed directly to S3, nothing written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
});

const router = express.Router();

// ── Admin ────────────────────────────────────────────────────────────────────
router.get   ("/pending",                         verifyToken, requireAdmin,          getPendingPockets);
router.post  ("/eligibility/:userId",             verifyToken, requireAdmin,          setPocketEligibility);
router.post  ("/:pocketId/review",                verifyToken, requireAdmin,          reviewPocket);

// ── Creator — pocket CRUD ────────────────────────────────────────────────────
router.get   ("/mine",                        verifyToken, requirePocketEligible, getMyPocket);
router.post  ("/",                            verifyToken, requirePocketEligible, upsertPocket);
router.post  ("/submit",                      verifyToken, requirePocketEligible, submitForReview);

// ── Creator — media library ──────────────────────────────────────────────────
router.get   ("/media",                       verifyToken, requirePocketEligible, listPocketMedia);
router.post  ("/media/upload",                verifyToken, requirePocketEligible, upload.single("file"), uploadPocketMedia);
router.delete("/media",                       verifyToken, requirePocketEligible, deletePocketMedia);

// ── Analytics (any logged-in user) ──────────────────────────────────────────
router.post  ("/entries/:entryId/analytics",  verifyToken,                        trackAnalytics);

export default router;