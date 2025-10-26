// routes/users.js
import express from "express";
import verifyToken from "../middlewares/authMiddleware.js";


const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    // Only return the user ID
    res.json({ _id: req.user.id });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
