import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Session from "../models/Session.js";
import crypto from "crypto";
import dotenv from "dotenv";
import User from "../models/User.js"; // Correct import after fixing export
import passport from "passport";
import verifyToken from "../middlewares/authMiddleware.js";

dotenv.config();
const router = express.Router();
const url = process.env.FRONTEND_URL
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,        // true only on HTTPS
  sameSite: isProduction ? "none" : "lax",
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};
const clearCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
};

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Handle Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${url}/login` }),
  async (req, res) => {
    try {
      const { user, token } = req.user;

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      await Session.create({
        userId: user._id,
        deviceId: req.deviceId,
        tokenHash,
        userAgent: req.headers["user-agent"],
        ip: req.ip
      });
      console.log("Session created for userId", user._id);
      res.cookie("token", token, cookieOptions);
      res.redirect(`${url}/`);

    } catch (err) {
      console.error("Google login error:", err);
      res.redirect(`${url}/login`);
    }
  }
);


router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    const token = jwt.sign({ id: newUser._id },process.env.JWT_SECRET, { expiresIn: "30d" });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await Session.create({
      userId: newUser._id,
      deviceId: req.deviceId,
      tokenHash,
      userAgent: req.headers["user-agent"],
      ip: req.ip
    });
    res.cookie("token", token, cookieOptions);
    res.status(201).json({ message: "User registered & authenticated successfully", user: newUser, token });
  } catch (error) {
    console.error("Error in registration:", error);
    // res.status(500).json({ error: "Registration failed" });
  }
});



// Login Route
router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    }).select("+password"); // ✅ include password field explicitly

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    
    await Session.create({
      userId: user._id,
      deviceId: req.deviceId,
      tokenHash,
      userAgent: req.headers["user-agent"],
      ip: req.ip
    });
    console.log("Session created for userId", user._id);

    res.cookie("token", token, cookieOptions);


    res.status(200).json({ message: "Login successful", token, user });
  } catch (err) {
    console.error("Error in login:", err);
    res.status(500).json({ error: "Login failed" });
  }
});


// Verify Token Route
router.get("/verify", verifyToken, (req, res) => {
  res.status(200).json({ message: "Token is valid", user: req.user });
});

// Logout Route
router.post("/logout", verifyToken, async (req, res) => {
  const userId = req.user._id;
  const deviceId = req.deviceId;

  await Session.deleteMany({
    userId,
    deviceId
  });

  res.clearCookie("token", clearCookieOptions);
  res.json({ message: "Logged out successfully" });
});



router.post("/switch-account", async (req, res) => {
  try {
    const { userId } = req.body;
    const deviceId = req.deviceId;
    console.log("deviceId:", deviceId);
    console.log("userId:", userId);
    // 1️⃣ Ensure target account exists on this device
    const targetSession = await Session.findOne({ userId, deviceId });
    console.log("targetSession:", targetSession);
    if (!targetSession) {
      return res.status(401).json({
        error: "Account not logged in on this device"
      });
    }

    // 3️⃣ Issue new token for target user
    const newToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    const newHash = crypto
      .createHash("sha256")
      .update(newToken)
      .digest("hex");

    await Session.create({
      userId,
      deviceId,
      tokenHash: newHash,
      userAgent: req.headers["user-agent"],
      ip: req.ip
    });

    // 4️⃣ Set cookie
    res.cookie("token", newToken, cookieOptions);

    const user = await User.findById(userId).select("-password");
    console.log("Switched account:", user);
    res.json({ message: "Switched account", user });

  } catch (err) {
    console.error("Switch error:", err);
    res.status(500).json({ error: "Switch failed" });
  }
});

export default router;
