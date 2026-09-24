// routes/adminIntelligence.js
//
// Mount at: app.use("/api/admin/intelligence", adminMiddleware, router)
//
// Endpoints:
//   GET /overview
//   GET /growth
//   GET /users
//   GET /posts
//   GET /creators
//   GET /games
//   GET /models
//   GET /ads
//   GET /discovery
//   GET /alerts

import express from "express";
import {
  getOverview,
  getGrowth,
  getAlerts,
  getDiscovery,
  getAds,
} from "../services/adminIntelligence.js";
import {
  listUsers,
  listPosts,
  listCreators,
  listGames,
  listModels,
} from "../services/adminList.js";
import {
  retryFailedGameSnapshots, createGameSnapshots
} from "../services/gameSnapshotRecovery.js";
import verifyToken       from "../middlewares/authMiddleware.js";
import requireAdmin      from "../middlewares/adminMiddleware.js";



const router = express.Router();
router.use(verifyToken);
router.use(requireAdmin);

// ── helpers ──────────────────────────────────────────────────────────────────

function ok(res, data) {
  res.json({ success: true, data });
}

function fail(res, err, status = 500) {
  console.error("[AdminIntelligence]", err);
  res.status(status).json({ success: false, message: err?.message ?? String(err) });
}

function intParam(val, fallback) {
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

// ── Overview ─────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/overview
 * Query: range | from & to
 */
router.get("/overview", async (req, res) => {
  try {
    ok(res, await getOverview(req.query));
  } catch (e) { fail(res, e); }
});

// ── Growth ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/growth
 */
router.get("/growth", async (req, res) => {
  try {
    ok(res, await getGrowth(req.query));
  } catch (e) { fail(res, e); }
});

// ── Users ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/users
 * Query: page, pageSize, search, role, verified, range, from, to
 */
router.get("/users", async (req, res) => {
  try {
    const { page, pageSize, search, role, verified, range, from, to } = req.query;
    ok(res, await listUsers({
      page:     intParam(page, 1),
      pageSize: intParam(pageSize, 20),
      search, role, verified, range, from, to,
    }));
  } catch (e) { fail(res, e); }
});

// ── Posts ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/posts
 * Query: page, pageSize, search, type, sortBy, range, from, to
 */
router.get("/posts", async (req, res) => {
  try {
    const { page, pageSize, search, type, sortBy, range, from, to } = req.query;
    ok(res, await listPosts({
      page:     intParam(page, 1),
      pageSize: intParam(pageSize, 20),
      search, type, sortBy, range, from, to,
    }));
  } catch (e) { fail(res, e); }
});

// ── Creators ──────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/creators
 * Query: page, pageSize, rankBy, range, from, to
 */
router.get("/creators", async (req, res) => {
  try {
    const { page, pageSize, rankBy, range, from, to } = req.query;
    ok(res, await listCreators({
      page:     intParam(page, 1),
      pageSize: intParam(pageSize, 20),
      rankBy, range, from, to,
    }));
  } catch (e) { fail(res, e); }
});

// ── Games ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/games
 * Query: page, pageSize, search, sortBy, range, from, to
 */
router.get("/games", async (req, res) => {
  try {
    const { page, pageSize, search, sortBy, range, from, to } = req.query;
    ok(res, await listGames({
      page:     intParam(page, 1),
      pageSize: intParam(pageSize, 20),
      search, sortBy, range, from, to,
    }));
  } catch (e) { fail(res, e); }
});


router.post(
  "/games/:postId/create-snapshots",
  async (req, res) => {
    try {
      const result =
        await createGameSnapshots(
          req.params.postId
        );

      return res.json({
        success: true,
        message:
          result.mode === "already_ready"
            ? "Game snapshots are already ready"
            : result.mode === "already_in_progress"
              ? "Game snapshot preparation is already in progress"
              : "Game snapshot preparation queued",
        data: result,
      });
    } catch (error) {
      console.error(
        "[Admin] Failed to create game snapshots:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        success: false,
        message:
          error.message ||
          "Failed to create game snapshots",
      });
    }
  }
);

// ── Game Snapshot Recovery ───────────────────────────────────────────────────

/**
 * POST /api/admin/intelligence/games/:postId/retry-snapshots
 *
 * Admin-only recovery of failed regional game snapshots.
 *
 * Only regions that are not READY are retried.
 */
router.post(
  "/games/:postId/retry-snapshots",
  async (req, res) => {
    try {
      const result =
        await retryFailedGameSnapshots(
          req.params.postId
        );

      return res.json({
        success: true,
        message: "Snapshot recovery queued",
        data: result,
      });
    } catch (e) {
      return fail(
        res,
        e,
        e.statusCode || 500
      );
    }
  }
);

// ── Models ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/models
 * Query: page, pageSize, sortBy, range, from, to
 */
router.get("/models", async (req, res) => {
  try {
    const { page, pageSize, sortBy, range, from, to } = req.query;
    ok(res, await listModels({
      page:     intParam(page, 1),
      pageSize: intParam(pageSize, 20),
      sortBy, range, from, to,
    }));
  } catch (e) { fail(res, e); }
});

// ── Ads ───────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/ads
 * Query: range, from, to
 */
router.get("/ads", async (req, res) => {
  try {
    ok(res, await getAds(req.query));
  } catch (e) { fail(res, e); }
});

// ── Discovery ─────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/discovery
 * Query: range, from, to
 */
router.get("/discovery", async (req, res) => {
  try {
    ok(res, await getDiscovery(req.query));
  } catch (e) { fail(res, e); }
});

// ── Alerts ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/alerts
 * No query params — always returns live alert state.
 */
router.get("/alerts", async (req, res) => {
  try {
    ok(res, await getAlerts());
  } catch (e) { fail(res, e); }
});

export default router;