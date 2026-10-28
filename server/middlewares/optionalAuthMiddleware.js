
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Session from "../models/Session.js";
import User from "../models/User.js";

const optionalAuthMiddleware = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return next();
  }

  try {
    let decoded;

    try {
      // Match verifyToken: support the current access token.
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch {
      // Preserve compatibility with legacy JWTs.
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const session = await Session.findOne({
      tokenHash,
      deviceId: req.deviceId,
    });

    if (!session) {
      return next();
    }

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return next();
    }

    session.lastUsed = new Date();
    await session.save();

    req.user = user;
  } catch (err) {
    // Invalid or expired token: preserve the existing guest fallback.
    console.debug("Optional auth token verification failed:", err.message);

  }

  return next();
};

export default optionalAuthMiddleware;
