import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Session from "../models/Session.js";
import crypto from "crypto";
import { createRateLimiter, ipRateLimiter } from "../middlewares/rateLimiter.js";
import dotenv from "dotenv";
import User, {
  validateUsernameFormat,
  calculateAge,
  MIN_AGE,
} from "../models/User.js";
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
} from "../utils/authToken.js";
import PendingRegistration from "../models/PendingRegistration.js";
import passport from "passport";
import { sendResetEmail } from "../services/sendResetEmail.js";
import { onUserCreated } from "../services/gorse.hooks.js";
import { sendVerificationEmail } from "../services/sendVerificationEmail.js";
import verifyToken from "../middlewares/authMiddleware.js";


dotenv.config();
const router = express.Router();
const url = process.env.FRONTEND_URL
const isProduction = process.env.NODE_ENV === "production";
const authLimiter = createRateLimiter("sessionStart");
const verifyLimiter = ipRateLimiter(10, 60);
// Generous but abuse-resistant limit for live typing checks
const usernameCheckLimiter = ipRateLimiter(30, 60);

const authCookieOptions = {
  httpOnly: true,
  secure: isProduction, // only true in production
  sameSite: isProduction ? "none" : "lax",
  ...(isProduction && { domain: ".rigzer.com" }), // only add in production
  path: "/",
};

const clearCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  ...(isProduction && { domain: ".rigzer.com" }),
  path: "/",
};

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Handle Google OAuth callback
// ... existing imports

// Handle Google OAuth callback
router.get(
  "/google/callback",
  // 1. UPDATE FAILURE REDIRECT
  passport.authenticate("google", { session: false, failureRedirect: `${url}/auth` }),
  async (req, res) => {
    try {
      if (req.user.isNew) {
        const tempToken = jwt.sign(
          { email: req.user.googleProfile.email },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        // 2. UPDATE NEW USER REDIRECT
        const redirectUrl = new URL(`${url}/auth`);
        redirectUrl.searchParams.set("googleSetup", "true");
        redirectUrl.searchParams.set("tempToken", tempToken);
        redirectUrl.searchParams.set("name", encodeURIComponent(req.user.googleProfile.displayName));

        return res.redirect(redirectUrl.toString());
      }


      // Existing Google user continues login with access + refresh tokens.
      const { user } = req.user;

      const accessToken = createAccessToken(user._id);
      const refreshToken = createRefreshToken();

      const tokenHash = crypto
        .createHash("sha256")
        .update(accessToken)
        .digest("hex");

      const refreshTokenExpiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      );

      await Session.create({
        userId: user._id,
        deviceId: req.deviceId,
        tokenHash,
        refreshTokenHash: hashRefreshToken(refreshToken),
        refreshTokenExpiresAt,
        userAgent: req.headers["user-agent"],
        ip: req.ip,
      });

      res.cookie("token", accessToken, {
        ...authCookieOptions,
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", refreshToken, {
        ...authCookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.redirect(`${url}/`);
    } catch (err) {
      console.error("Google login error:", err);
      // 3. UPDATE ERROR REDIRECT
      res.redirect(`${url}/auth`);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Finalize Google Account Creation (Called from frontend)
// ─────────────────────────────────────────────────────────────
router.post("/google-complete", authLimiter, async (req, res) => {
  try {
    const { username, displayName, birthdate, tempToken } = req.body;

    if (!tempToken) return res.status(400).json({ error: "Missing authorization token" });

    // Verify temp JWT token payload to retrieve the authenticated email
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Token expired or invalid. Please try logging in with Google again." });
    }
    const email = decoded.email;

    // Validate incoming details
    const cleanUsername = username.trim().toLowerCase();
    const usernameError = validateUsernameFormat(cleanUsername);
    if (usernameError) return res.status(400).json({ error: usernameError });

    const parsedBirthdate = new Date(birthdate);
    if (isNaN(parsedBirthdate.getTime()) || parsedBirthdate > new Date()) {
      return res.status(400).json({ error: "Invalid birthdate" });
    }
    if (calculateAge(parsedBirthdate) < MIN_AGE) {
      return res.status(403).json({ error: `You must be at least ${MIN_AGE} years old.` });
    }

    // Check collisions
    const existingUser = await User.findOne({ $or: [{ email }, { username: cleanUsername }] });
    if (existingUser) {
      if (existingUser.email === email) return res.status(400).json({ error: "Account already exists with this email." });
      return res.status(400).json({ error: "Username already taken." });
    }

    // Create the finalized user
    const user = await User.create({
      username: cleanUsername,
      displayName: displayName.trim(),
      email: email,
      birthdate: parsedBirthdate,
      isGoogleUser: true
    });

    // Create session / token

    const accessToken = createAccessToken(user._id);
    const refreshToken = createRefreshToken();

    const tokenHash = crypto
      .createHash("sha256")
      .update(accessToken)
      .digest("hex");

    const refreshTokenExpiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    await Session.create({
      userId: user._id,
      deviceId: req.deviceId,
      tokenHash,
      refreshTokenHash: hashRefreshToken(refreshToken),
      refreshTokenExpiresAt,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });

    onUserCreated(user._id.toString());

    res.cookie("token", accessToken, {
      ...authCookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      ...authCookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Account created successfully",
      user,
    });

    // Inside /google-complete route in auth.js
  } catch (error) {
    console.error("Error finalizing Google setup:", error);

    // ADD THIS: Explicitly check for Mongoose Validation Errors
    if (error.name === 'ValidationError') {
      // Get the first error message from the validation object
      const firstError = Object.values(error.errors)[0]?.message || "Invalid input";
      return res.status(400).json({ error: firstError });
    }

    // Handle MongoDB duplicate key errors (code 11000)
    if (error.code === 11000) {
      return res.status(400).json({ error: "Username or email is already taken." });
    }

    res.status(500).json({ error: "Failed to create account. Please try again." });
  }
});


// ─────────────────────────────────────────────────────────────
// Real-time username availability check (used by signup form)
// ─────────────────────────────────────────────────────────────
router.get("/check-username", usernameCheckLimiter, async (req, res) => {
  try {
    const raw = req.query.username;

    if (!raw || typeof raw !== "string") {
      return res.status(400).json({ available: false, error: "Username is required" });
    }

    const username = raw.trim().toLowerCase();

    const formatError = validateUsernameFormat(username);
    if (formatError) {
      return res.status(200).json({ available: false, error: formatError });
    }

    const [userExists, pendingExists] = await Promise.all([
      User.exists({ username }),
      PendingRegistration.exists({ username }),
    ]);

    if (userExists || pendingExists) {
      return res.status(200).json({ available: false, error: "Username is already taken" });
    }

    return res.status(200).json({ available: true });
  } catch (error) {
    console.error("Error checking username:", error);
    res.status(500).json({ available: false, error: "Could not check username right now" });
  }
});

router.post("/register", authLimiter, async (req, res) => {
  try {
    const { username: rawUsername, displayName, email, password, birthdate } = req.body;
    const username = typeof rawUsername === "string" ? rawUsername.trim().toLowerCase() : rawUsername;

    // ── Basic presence checks ──
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: "Display name is required" });
    }
    if (displayName.trim().length > 30) {
      return res.status(400).json({ error: "Display name must be 30 characters or fewer" });
    }
    if (!birthdate) {
      return res.status(400).json({ error: "Birthdate is required" });
    }

    // ── Username format validation ──
    const usernameError = validateUsernameFormat(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    // ── Age gate (13+) ──
    const parsedBirthdate = new Date(birthdate);
    if (isNaN(parsedBirthdate.getTime())) {
      return res.status(400).json({ error: "Invalid birthdate" });
    }
    if (parsedBirthdate > new Date()) {
      return res.status(400).json({ error: "Birthdate cannot be in the future" });
    }
    if (calculateAge(parsedBirthdate) < MIN_AGE) {
      return res.status(403).json({
        error: `You must be at least ${MIN_AGE} years old to create an account`,
      });
    }

    // Check if user already exists
    const [
      emailExists,
      usernameExists,
    ] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ username }),
    ]);

    if (emailExists) {
      return res.status(400).json({
        error: "Email already in use",
      });
    }

    if (usernameExists) {
      return res.status(400).json({
        error: "Username already taken",
      });
    }


    await PendingRegistration.deleteMany({
      $or: [
        { email },
        { username },
      ],
    });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // 🔐 Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // 🔐 Hash the OTP
    const hashedOTP = crypto
      .createHmac("sha256", process.env.OTP_SECRET)
      .update(otp)
      .digest("hex");
    // Create user in PendingRegistration

    const pending = new PendingRegistration({
      username,
      displayName: displayName.trim(),
      email,
      password: hashedPassword,
      birthdate: parsedBirthdate,
      emailVerificationOTP: hashedOTP,
      emailVerificationExpires: Date.now() + 10 * 60 * 1000,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    await pending.save();

    await sendVerificationEmail(email, otp);

    return res.status(200).json({
      message: "OTP sent",
      requiresVerification: true,
      email,
    });
  } catch (error) {
    console.error("Error in registration:", error);
    if (error.name === "ValidationError") {
      const firstError = Object.values(error.errors)[0]?.message || "Invalid input";
      return res.status(400).json({ error: firstError });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});
// Verify email
router.post("/verify-email", verifyLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    const hashedOTP = crypto
      .createHmac("sha256", process.env.OTP_SECRET)
      .update(otp)
      .digest("hex");

    const pending = await PendingRegistration.findOne({
      email,
      emailVerificationOTP: hashedOTP,
      emailVerificationExpires: { $gt: Date.now() },
    }).select("+password +emailVerificationOTP +emailVerificationExpires");

    if (!pending) {
      return res.status(400).json({
        error: "Invalid or expired OTP",
      });
    }


    const user = await User.create({
      username: pending.username,
      displayName: pending.displayName,
      email: pending.email,
      password: pending.password,
      birthdate: pending.birthdate,
    });

    await PendingRegistration.deleteOne({
      _id: pending._id,
    });

    // 🔥 Now create session (ONLY AFTER VERIFY)

    const accessToken = createAccessToken(user._id);
    const refreshToken = createRefreshToken();

    const tokenHash = crypto
      .createHash("sha256")
      .update(accessToken)
      .digest("hex");

    const refreshTokenExpiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    await Session.create({
      userId: user._id,
      deviceId: req.deviceId,
      tokenHash,
      refreshTokenHash: hashRefreshToken(refreshToken),
      refreshTokenExpiresAt,
      userAgent: req.headers["user-agent"],
      ip: req.ip
    });

    onUserCreated(user._id.toString());

    res.cookie("token", accessToken, {
      ...authCookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      ...authCookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: "Email verified successfully",
      user
    });
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

// Login Route
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    const user = await User.findOne({
      $or: [
        { email: emailOrUsername.toLowerCase() },
        { username: emailOrUsername }
      ]
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordValid) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    const accessToken = createAccessToken(user._id);
    const refreshToken = createRefreshToken();

    const tokenHash = crypto
      .createHash("sha256")
      .update(accessToken)
      .digest("hex");

    const refreshTokenExpiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    await Session.create({
      userId: user._id,
      deviceId: req.deviceId,
      tokenHash,
      refreshTokenHash: hashRefreshToken(refreshToken),
      refreshTokenExpiresAt,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });

    console.log(
      "Session created for userId",
      user._id
    );

    res.cookie("token", accessToken, {
      ...authCookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      ...authCookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login successful",
      user,
    });

  } catch (err) {
    console.error("Error in login:", err);

    return res.status(500).json({
      error: "Login failed",
    });
  }
});

// Verify Token Route
router.get("/verify", verifyToken, (req, res) => {
  res.status(200).json({ message: "Token is valid", user: req.user });
});


router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const deviceId = req.deviceId;

    if (!refreshToken || !deviceId) {
      res.clearCookie("token", clearCookieOptions);
      res.clearCookie("refreshToken", clearCookieOptions);

      return res.status(401).json({
        message: "Refresh token is missing or invalid.",
      });
    }

    const oldRefreshTokenHash = hashRefreshToken(refreshToken);
    const now = new Date();

    // Find the current session associated with this refresh token.
    const session = await Session.findOne({
      refreshTokenHash: oldRefreshTokenHash,
      deviceId,
      refreshTokenExpiresAt: { $gt: now },
    });

    if (!session) {
      // A concurrent request may already have rotated this token.
      // Avoid clearing cookies until we distinguish that case.

      const accessToken = req.cookies.token;
      let accessPayload = null;

      // Verify the access token's signature, but allow it to be expired.
      // The token is used only to identify the account for race detection.
      if (accessToken) {
        const secrets = [
          process.env.ACCESS_TOKEN_SECRET,
          process.env.JWT_SECRET,
        ].filter(Boolean);

        for (const secret of [...new Set(secrets)]) {
          try {
            accessPayload = jwt.verify(accessToken, secret, {
              ignoreExpiration: true,
            });
            break;
          } catch(err) {
            console.error("Access token verification failed", err);
          }
        }
      }

      const activeDeviceSession = accessPayload?.id
        ? await Session.exists({
          userId: accessPayload.id,
          deviceId,
          refreshTokenExpiresAt: { $gt: now },
        })
        : null;

      if (activeDeviceSession) {
        return res.status(409).json({
          message: "Session credentials changed. Please retry the request.",
        });
      }


      res.clearCookie("token", clearCookieOptions);
      res.clearCookie("refreshToken", clearCookieOptions);

      return res.status(401).json({
        message: "Session expired. Please log in again.",
      });
    }

    const newAccessToken = createAccessToken(session.userId);
    const newRefreshToken = createRefreshToken();

    const newAccessTokenHash = crypto
      .createHash("sha256")
      .update(newAccessToken)
      .digest("hex");

    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

    // Atomically rotate only if the old refresh token is still current.
    const updatedSession = await Session.findOneAndUpdate(
      {
        _id: session._id,
        refreshTokenHash: oldRefreshTokenHash,
        deviceId,
        refreshTokenExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          tokenHash: newAccessTokenHash,
          refreshTokenHash: newRefreshTokenHash,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedSession) {
      // Another request may have won the rotation race.
      // Do not clear cookies that the winning request may be updating.
      return res.status(409).json({
        message: "Session credentials changed. Please retry the request.",
      });
    }

    const remainingRefreshTime =
      updatedSession.refreshTokenExpiresAt.getTime() - Date.now();

    if (remainingRefreshTime <= 0) {
      await Session.deleteOne({ _id: updatedSession._id });

      res.clearCookie("token", clearCookieOptions);
      res.clearCookie("refreshToken", clearCookieOptions);

      return res.status(401).json({
        message: "Session expired. Please log in again.",
      });
    }

    res.cookie("token", newAccessToken, {
      ...authCookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", newRefreshToken, {
      ...authCookieOptions,
      maxAge: remainingRefreshTime,
    });

    return res.status(200).json({
      message: "Session refreshed successfully.",
    });
  } catch (error) {
    console.error("Refresh token error:", error);

    return res.status(500).json({
      message: "Unable to refresh session.",
    });
  }
});


// Logout Route
router.post("/logout", async (req, res) => {
  try {
    const deviceId = req.deviceId;
    const accessToken = req.cookies?.token;
    const refreshToken = req.cookies?.refreshToken;

    const tokenHashes = [];

    if (accessToken) {
      tokenHashes.push(
        crypto.createHash("sha256").update(accessToken).digest("hex")
      );
    }

    if (refreshToken) {
      tokenHashes.push(hashRefreshToken(refreshToken));
    }

    // Find the current session using either credential.
    // This also works when the access JWT has expired.
    if (deviceId && tokenHashes.length > 0) {
      const session = await Session.findOne({
        deviceId,
        $or: [
          ...(accessToken
            ? [{
              tokenHash: crypto
                .createHash("sha256")
                .update(accessToken)
                .digest("hex"),
            }]
            : []),
          ...(refreshToken
            ? [{ refreshTokenHash: hashRefreshToken(refreshToken) }]
            : []),
        ],
      }).select("+refreshTokenHash");

      if (session) {
        // Preserve existing behavior: log out this account
        // from this device, including its other sessions here.
        await Session.deleteMany({
          userId: session.userId,
          deviceId,
        });
      }
    }

    res.clearCookie("token", clearCookieOptions);
    res.clearCookie("refreshToken", clearCookieOptions);

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      error: "Logout failed",
    });
  }
});

router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // security: don't reveal existence
      return res.json({ message: "If the email exists, a reset link has been sent" });
    }

    // Google users cannot reset password
    if (user.isGoogleUser) {
      return res.json({ message: "Use Google login to access your account" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    res.json({ message: "If the email exists, a reset link has been sent" });
    // 🔔 send email here
    sendResetEmail(user.email, resetUrl);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Password reset failed" });
  }
});

router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+password");

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // 🔥 clear token
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;


    await user.save();

    // Revoke all sessions across all devices.
    await Session.deleteMany({ userId: user._id });

    // Clear authentication cookies on the browser performing the reset.
    res.clearCookie("token", clearCookieOptions);
    res.clearCookie("refreshToken", clearCookieOptions);

    return res.json({
      message: "Password reset successful. Please login again."
    });


  } catch (err) {
    res.status(500).json({ error: "Reset failed" });
  }
});

router.post("/switch-account", authLimiter, async (req, res) => {
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

    const accessToken = createAccessToken(userId);
    const refreshToken = createRefreshToken();

    const tokenHash = crypto
      .createHash("sha256")
      .update(accessToken)
      .digest("hex");

    const refreshTokenExpiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    await Session.create({
      userId,
      deviceId,
      tokenHash,
      refreshTokenHash: hashRefreshToken(refreshToken),
      refreshTokenExpiresAt,
      userAgent: req.headers["user-agent"],
      ip: req.ip
    });

    res.cookie("token", accessToken, {
      ...authCookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      ...authCookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const user = await User.findById(userId).select("-password");
    console.log("Switched account:", user);
    res.json({ message: "Switched account", user });

  } catch (err) {
    console.error("Switch error:", err);
    res.status(500).json({ error: "Switch failed" });
  }
});

export default router;