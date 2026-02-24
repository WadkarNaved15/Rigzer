import jwt from "jsonwebtoken";
import crypto from "crypto";
import Session from "../models/Session.js";
import User from "../models/User.js";

const optionalAuthMiddleware = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return next(); // no token → guest
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const session = await Session.findOne({
      tokenHash,
      deviceId: req.deviceId,
    });

    if (!session) {
      return next(); // invalid session → treat as guest
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(); // user not found → guest
    }

    session.lastUsed = new Date();
    await session.save();

    req.user = user; // attach user if valid
  } catch (err) {
    // If token invalid → treat as guest
  }

  next();
};

export default optionalAuthMiddleware;