import jwt from "jsonwebtoken";
import crypto from "crypto";
import Session from "../models/Session.js";
import User from "../models/User.js";

const verifyToken = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const session = await Session.findOne({
      tokenHash,
      deviceId: req.deviceId
    });

    if (!session) {
      return res.status(401).json({ error: "Session expired" });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(403).json({ error: "User not found" });

    session.lastUsed = new Date();
    await session.save();

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

export default verifyToken;
