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

// Memory storage — buffers passed directly to S3, nothing written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:  30 * 1024 * 1024,   // 30 MB per file — must match controller
    files:     10,
  },
});

const router = express.Router();

// ── Explicit OPTIONS handler for every sub-path ──────────────────────────────
// Browsers send a preflight OPTIONS before POST /media/upload (and any other
// cross-origin request with a custom header like Authorization).
// If your global CORS middleware is registered correctly in app.js this block
// is redundant — but it acts as a safety net so the route itself never 404s
// a preflight, which would silently drop the CORS headers.
router.options("*", (req, res) => res.sendStatus(204));

// ── Admin ────────────────────────────────────────────────────────────────────
router.get   ("/pending",              verifyToken, requireAdmin,          getPendingPockets);
router.post  ("/eligibility/:userId",  verifyToken, requireAdmin,          setPocketEligibility);
router.post  ("/:pocketId/review",     verifyToken, requireAdmin,          reviewPocket);

// ── Creator — pocket CRUD ────────────────────────────────────────────────────
router.get   ("/mine",                 verifyToken, requirePocketEligible, getMyPocket);
router.post  ("/",                     verifyToken, requirePocketEligible, upsertPocket);
router.post  ("/submit",               verifyToken, requirePocketEligible, submitForReview);

// ── Creator — media library ──────────────────────────────────────────────────
router.get   ("/media",                verifyToken, requirePocketEligible, listPocketMedia);

// upload.array("files", 10) accepts up to 10 files under the field name "files".
// The controller receives req.files (array) instead of req.file.
router.post("/media/upload", verifyToken, requirePocketEligible,
  (req, res, next) => upload.array("files", 10)(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File exceeds 30 MB limit." });
    }
    if (err?.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ message: "Maximum 10 files per upload." });
    }
    if (err) return res.status(400).json({ message: err.message });
    next();
  }),
  uploadPocketMedia
);

router.delete("/media",                verifyToken, requirePocketEligible, deletePocketMedia);

// ── Analytics (any logged-in user) ──────────────────────────────────────────
router.post  ("/entries/:entryId/analytics", verifyToken, trackAnalytics);

export default router;