// routes/admin.routes.js
// Mount as: app.use("/api/admin", adminRoutes)  (behind your isAdmin middleware)

import express      from "express";
import User         from "../models/User.js";
import Pocket       from "../models/Pocket.js";
import verifyToken  from "../middlewares/authMiddleware.js";
import requireAdmin from "../middlewares/adminMiddleware.js";

const router = express.Router();
router.use(verifyToken, requireAdmin);

/**
 * GET /api/admin/users/search?q=<query>
 * Search users by username or email for the eligibility manager.
 * Returns top 20 matches with isPocketEligible and pocketStatus fields.
 */
router.get("/users/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.status(400).json({ message: "q is required" });

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: "i" } },
        { email:    { $regex: q, $options: "i" } },
      ],
    })
      .select("username email avatar isPocketEligible createdAt")
      .limit(20)
      .lean();

    const userIds = users.map(u => u._id);
    const pockets = await Pocket.find({ owner: { $in: userIds } })
      .select("owner status")
      .lean();
    const pocketMap = Object.fromEntries(pockets.map(p => [p.owner.toString(), p.status]));

    const enriched = users.map(u => ({
      ...u,
      pocketStatus: pocketMap[u._id.toString()] ?? null,
    }));

    return res.status(200).json({ users: enriched });
  } catch (err) {
    console.error("admin/users/search:", err);
    return res.status(500).json({ message: "Search failed" });
  }
});

export default router;