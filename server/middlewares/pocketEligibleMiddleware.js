// middlewares/pocketEligibleMiddleware.js
//
// Must be used AFTER verifyToken.
// Blocks the route unless the user has been explicitly granted isPocketEligible.
// Being email-verified (isVerified) is NOT enough on its own.

import User from "../models/User.js";

const requirePocketEligible = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id, "isPocketEligible").lean();

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.isPocketEligible) {
      return res.status(403).json({
        message: "Your account is not eligible to manage a Pocket. Contact us to apply.",
      });
    }

    next();
  } catch (err) {
    console.error("requirePocketEligible:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export default requirePocketEligible;