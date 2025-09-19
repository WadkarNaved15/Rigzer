import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js"; // Correct import after fixing export
import passport from "passport";
import verifyToken from "../middlewares/authMiddleware.js";


const router = express.Router();
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Handle Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "http://localhost:5173/login" }),
  (req, res) => {
    res.cookie("token", req.user.token, { httpOnly: true, secure: false });
    res.redirect("http://localhost:5173/"); // Redirect to frontend
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
    res.cookie("token", token, { httpOnly: true, secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 }); // Set cookie for 30 days
    res.status(201).json({ message: "User registered & authenticated successfully", user: newUser, token });
  } catch (error) {
    console.error("Error in registration:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});



// Login Route
router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body; // Accepts either email or username

    // Find user by email OR username
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    // Check if user exists and password matches
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    // Set token in cookies
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(200).json({ message: "Login successful", token, user });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Verify Token Route
router.get("/verify", verifyToken, (req, res) => {
  res.status(200).json({ message: "Token is valid" ,user: req.user});
});

// Logout Route
router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

export default router;
