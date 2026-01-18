import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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
  domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};
const clearCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
};

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Handle Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${url}/login` }),
  (req, res) => {
    res.cookie("token", req.user.token, cookieOptions);
    res.redirect(`${url}/`); // Redirect to frontend
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
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
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
router.post("/logout", (_req, res) => {
  res.clearCookie("token", clearCookieOptions);
  res.json({ message: "Logged out successfully" });
});


export default router;
