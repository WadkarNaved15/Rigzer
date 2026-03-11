import User from "../models/User.js";

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // verifyToken sets req.user to a full Mongoose document, so use ._id
    const user = await User.findById(req.user._id, "role").lean();

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (err) {
    console.error("requireAdmin:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export default requireAdmin;