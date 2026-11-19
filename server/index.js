import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { RedisStore } from "connect-redis";
import dns from "dns";
import passport from "passport";
import "./passportConfig.js"
import http from "http";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import s3 from "./s3.js";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import GameSession from "./models/GameSession.js";
import fetch from "node-fetch";
import { releaseInstance } from "./services/instanceAllocator.js";
import { sessionStreams } from "./services/sessionStream.js";
import { initializeSessionPubSub } from "./services/sessionPubSub.js";
import { initGeoService } from "./services/geoService.js";
import { sendEventToQueue } from "./utils/sendEventToQueue.js";
import cacheService from "./services/cacheService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Session from "./models/Session.js";
import E2EEDevice from "./models/E2EEDevice.js";

// ✅ Import your existing Redis client
import redisClient from "./config/redis.js";
import startCleanupWorker from "./services/sessionCleanupWorker.js";

// ROUTES
import User from "./models/User.js";
import modelUploadRouter from "./routes/compression.js";
import internalNotificationRoutes from "./routes/internalNotification.js";
import chatMediaUpload from "./routes/chatMediaUpload.js";
import deviceMiddleware from "./middlewares/deviceMiddleware.js";
import ArticleRoutes from "./routes/articlesRoutes.js";
import allPostRoutes from "./routes/allPosts.js";
import gameStatus from "./routes/gameStatus.js"
import authRoutes from "./routes/auth.js";
import adRoutes from "./routes/adRoutes.js";
import prerollAdRoutes from "./routes/prerollAd.js";
import postRoutes from "./routes/postRoutes.js";
import pocketFetchRoutes from "./routes/pocketRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import meRoutes from "./routes/me.js";
import chatRoutes from "./routes/chatRoutes.js";
import Chat from "./models/Chat.js";
import chatRequestRoutes from "./routes/chatRequestRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import feedBackRoutes from "./routes/feedback.js";
import homeFeedbackRoutes from "./routes/feedbackRoutes.js"
import gameFeedbackRoutes from "./routes/gameFeedbackRoutes.js"
import streamFeedbackRoutes from "./routes/streamFeedback.js";
import commentRoutes from "./routes/comment.js";
import gameRoutes from "./routes/gameRoutes.js";
import interactionRoutes from "./routes/interactions.js"
import gameZip from "./routes/game.js";
import devlogsRoutes from "./routes/devlogs.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import likesRoutes from "./routes/likes.js";
import userRoutes from "./routes/userRoutes.js";
import metadataRoutes from "./routes/metadata.js";
import gameFetch from "./routes/gameFetch.js";
import recommendationRoutes from "./routes/recommendation.js";
import wishListRoutes from "./routes/wishListRoutes.js";
import Message from "./models/Message.js";
import searchRoutes from "./routes/searchRoutes.js";
import followRoutes from "./routes/followRoutes.js";
import canvasRoutes from "./routes/canvasRoutes.js";
import sessionRoutes from "./routes/sessions.js";
import internalRoutes from "./routes/internal.js";
import pocketRoutes from "./routes/pocket.js";
import creatorAnalyticsRoutes from "./routes/CreatorAnalytics.js";
import analyticsRoutes from "./routes/analytics.js"
import gamePostRoutes from "./routes/gamePosts.js"
import chatEncryptionRoutes from "./routes/chatEncryptionRoutes.js";
import e2eeRoutes from "./routes/e2eeRoutes.js";

import streamProxyRouter, { handleWsUpgrade } from "./routes/streamProxy.js";
import adminCreditsRoutes from "./routes/adminCredits.js";
import adminSessionRouter from "./routes/adminSessionMonitoring.js";
import adminIntelligenceRouter from "./routes/adminIntelligence.js";
import AdminSponsoredGamesRouter from "./routes/adminSponsoredGames.js";

import RazorpayWebhookRouter from "./routes/razorpayWebhook.js";

import adminRouter from "./routes/admin.js"

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, "logs");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFilePath() {
  const date = new Date().toISOString().slice(0, 10);

  return path.join(
    LOG_DIR,
    `backend-${date}.log`
  );
}

function formatLogArgument(arg) {
  if (typeof arg === "string") {
    return arg;
  }

  if (arg instanceof Error) {
    return arg.stack || arg.message;
  }

  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}

function writeToLogFile(level, args) {
  try {
    const timestamp = new Date().toISOString();
    const message = args
      .map(formatLogArgument)
      .join(" ");

    const instanceId =
      process.env.INSTANCE_ID || "unknown-instance";

    const line =
      `[${timestamp}] [${level}] [instance=${instanceId}] ${message}\n`;

    fs.appendFileSync(
      getLogFilePath(),
      line,
      "utf8"
    );
  } catch (error) {
    process.stderr.write(
      `[LOGGER ERROR] ${error.message}\n`
    );
  }
}

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = (...args) => {
  originalConsoleLog(...args);
  writeToLogFile("INFO", args);
};

console.warn = (...args) => {
  originalConsoleWarn(...args);
  writeToLogFile("WARN", args);
};

console.error = (...args) => {
  originalConsoleError(...args);
  writeToLogFile("ERROR", args);
};

console.log(
  `File logging initialized: ${getLogFilePath()}`
);

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// REDIS CLIENT SETUP
// ============================================
// ✅ Use your existing redisClient for session store
// Create a separate pub/sub client for Socket.IO adapter
const redisIoPubClient = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    tls: false,
  },
});

const redisIoSubClient = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    tls: false,
  },
});

// Handle errors
redisIoPubClient.on("error", (err) => console.error("❌ Redis IO Pub Client Error:", err));
redisIoSubClient.on("error", (err) => console.error("❌ Redis IO Sub Client Error:", err));

// ============================================
// MIDDLEWARE
// ============================================

app.use(async (req, res, next) => {
  const host = req.headers.host?.split(":")[0].toLowerCase();

  const streamDomain = process.env.STREAM_DOMAIN?.toLowerCase();

  if (!streamDomain) {
    console.error("[STREAM] STREAM_DOMAIN is not configured");
    return next();
  }

  const suffix = `.${streamDomain}`;

  // Not a stream subdomain
  if (!host?.endsWith(suffix)) {
    return next();
  }

  // Extract token
  const token = host.slice(0, -suffix.length);

  // Make sure only one subdomain exists
  if (!token || token.includes(".")) {
    return res.sendStatus(404);
  }

  try {
    const stream = await cacheService.get(`stream:${token}`);

    if (!stream) {
      console.log(`[STREAM] Invalid token: ${token}`);
      return res.redirect(302, process.env.FRONTEND_URL);
    }

    const session = await GameSession.findById(stream.sessionId)
      .select("status")
      .lean();

    if (
      !session ||
      !["allocation_ready", "starting", "running"].includes(session.status)
    ) {
      console.log(`[STREAM] Invalid session for token ${token}`);

      return res.redirect(302, process.env.FRONTEND_URL);
    }

    return streamProxyRouter(req, res, next);

  } catch (err) {
    console.error("[STREAM] Validation error:", err);

    return res.redirect(302, process.env.FRONTEND_URL);
  }
});

// EXPRESS CORS
const isProduction = process.env.NODE_ENV === "production";

const corsWhitelist = isProduction
  ? [
    "https://www.rigzer.com",
    "https://rigzer.com",
    "https://stream.rigzer.com",
    /^https:\/\/.*\.stream\.rigzer\.com$/,
    process.env.FRONTEND_URL,
  ].filter(Boolean)
  : [
    "http://localhost:5173",
    "https://localhost:5173",

    // Your development frontend
    process.env.FRONTEND_URL,

    // Dev stream domain
    "https://dev-stream.rigzer.com",
    /^https:\/\/.*\.dev-stream\.rigzer\.com$/,

  ].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin, such as server-to-server requests,
      // Postman, curl, health checks, etc.
      if (!origin) {
        return callback(null, true);
      }

      const allowed = corsWhitelist.some((entry) => {
        if (typeof entry === "string") {
          return entry === origin;
        }

        return entry.test(origin);
      });

      if (allowed) {
        return callback(null, true);
      }

      console.warn(
        `[CORS] Blocked origin: ${origin} | Environment: ${process.env.NODE_ENV}`
      );

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,
  })
);

app.use(
  "/api/webhooks",
  RazorpayWebhookRouter
);


app.set("trust proxy", 1);
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

app.use(cookieParser());
app.use(deviceMiddleware)

// ============================================
// EXPRESS SESSION STORE (Redis-backed)
// ============================================
const redisStore = new RedisStore({ client: redisClient });

app.use(
  session({
    store: redisStore,
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());


// ============================================
// ROUTES
// ============================================
app.use("/api/auth", authRoutes);
app.use("/api/likes", likesRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/users", userRoutes);
app.use("/api/devlogs", devlogsRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/chat-requests", chatRequestRoutes);
app.use("/api/articles", ArticleRoutes);
app.use("/api/allposts", allPostRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/me", meRoutes);
app.use("/api/game", gameStatus);
app.use("/uploads", express.static("uploads"));
app.use("/api/ads", adRoutes);
app.use("/api/prerollads", prerollAdRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/media/upload", chatMediaUpload);
app.use("/api/wishlist", wishListRoutes);
app.use("/api/gameRoutes", gameRoutes);
app.use("/api/fetchpockets", pocketFetchRoutes);
app.use("/api/feedback", feedBackRoutes);
app.use("/api/v1/feedback", homeFeedbackRoutes);
app.use("/api/game-feedback", gameFeedbackRoutes);
app.use("/api/stream-feedback", streamFeedbackRoutes);
app.use("/api/recommend", recommendationRoutes);
app.use("/api/compression", modelUploadRouter);
app.use("/api/gameupload", gameZip);
app.use("/api/notifications", notificationRoutes);
app.use("/api/games", gameFetch);
app.use("/api/metadata", metadataRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/canvas", canvasRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/internal", internalRoutes);
app.use("/api/pockets", pocketRoutes);
app.use("/api/creatorAnalytics", creatorAnalyticsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/gamePosts", gamePostRoutes)
app.use("/api/chat/encryption", chatEncryptionRoutes);
app.use("/api/e2ee", e2eeRoutes);

// Admin routes (protected by your isAdmin middleware)
app.use("/api/admin", adminRouter);
app.use("/api/admin/credits", adminCreditsRoutes);
app.use("/api/admin/sessionMonitoring", adminSessionRouter);
app.use("/api/admin/intelligence", adminIntelligenceRouter);
app.use("/api/admin/sponsored-games", AdminSponsoredGamesRouter);

app.get("/health", async (req, res) => {
  const mongoHealthy = mongoose.connection.readyState === 1;
  let redisHealthy = false;

  try {
    await redisClient.ping();
    redisHealthy = true;
  } catch (err) {
    console.error("Redis health check failed:", err);
  }

  if (!mongoHealthy || !redisHealthy) {
    return res.status(500).json({
      status: "unhealthy",
      mongo: mongoHealthy ? "healthy" : "unhealthy",
      redis: redisHealthy ? "healthy" : "unhealthy",
    });
  }

  res.status(200).json({
    status: "healthy",
    mongo: "healthy",
    redis: "healthy",
  });
});


app.get("/stream-speed-test", (req, res) => {
  try {
    const bytes = Math.min(
      parseInt(req.query.bytes || "1048576", 10),
      5 * 1024 * 1024
    ); // max 5 MB

    const payload = Buffer.alloc(bytes, "a");

    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Length": payload.length,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    return res.status(200).send(payload);
  } catch (err) {
    console.error("stream-speed-test error:", err);
    return res.status(500).json({ message: "Speed test failed" });
  }
});

// ============================================
// HTTP SERVER & SOCKET.IO
// ============================================
const server = http.createServer(app);

server.on("upgrade", (req, socket, head) => {
  const host = req.headers.host
    ?.split(":")[0]
    .toLowerCase();

  const streamDomain = process.env.STREAM_DOMAIN?.toLowerCase();

  if (
    streamDomain &&
    host?.endsWith(`.${streamDomain}`)
  ) {
    handleWsUpgrade(req, socket, head);
  }
});
// SOCKET.IO (Real-Time Chat) with Redis Adapter
const io = new Server(server, {
  cors: {
    origin: corsWhitelist,
    credentials: true,
  },
});

app.set("io", io);


function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.substring(name.length + 1));
  } catch {
    return null;
  }
}

io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;

    const token = getCookieValue(cookieHeader, "token");
    const deviceId = getCookieValue(cookieHeader, "device_id");

    if (!token || !deviceId) {
      return next(new Error("Authentication required"));
    }

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET
      );
    } catch {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const session = await Session.findOne({
      tokenHash,
      deviceId,
    });

    if (!session) {
      return next(new Error("Session expired"));
    }

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return next(new Error("User not found"));
    }

    session.lastUsed = new Date();
    await session.save();

    // Identity comes from the verified JWT, never from client input.
    socket.userId = user._id.toString();
    socket.data.user = user;

    // Browser installation ID comes from the authenticated cookie.
    socket.data.browserDeviceId = deviceId;

    next();
  } catch (err) {
    console.error("Socket authentication error:", err);
    next(new Error("Authentication failed"));
  }
});


// Attach Redis adapter to Socket.IO
// This makes io.to(chatId).emit() and room membership work across all backends
io.adapter(createAdapter(redisIoPubClient, redisIoSubClient));

app.use("/api/internal-notify", internalNotificationRoutes(io));

// ============================================
// SOCKET.IO EVENT HANDLERS
// ============================================

io.on("connection", async (socket) => {
  const senderId = socket.userId;

  console.log("Authenticated socket connected:", socket.id, senderId);

  // Every authenticated socket automatically joins its own user room.
  socket.join(`user-${senderId}`);

  // ---------------------------------------
// Bind authenticated socket to E2EE device
// ---------------------------------------
socket.on("e2ee:bind-device", async (requestedDeviceId, ack) => {
  try {
    const deviceId = Number(requestedDeviceId);

    if (
      !Number.isInteger(deviceId) ||
      deviceId < 1 ||
      deviceId > 5
    ) {
      return ack?.({
        success: false,
        message: "Invalid E2EE device ID",
      });
    }

    const browserDeviceId = socket.data.browserDeviceId;

    if (!browserDeviceId) {
      return ack?.({
        success: false,
        message: "Browser device authentication missing",
      });
    }

    // Verify that this numeric E2EE device belongs to
    // the authenticated user and this browser installation.
    const device = await E2EEDevice.findOne({
      userId: senderId,
      deviceId,
      browserDeviceId,
      enabled: true,
    })
      .select("_id deviceId registered")
      .lean();

    if (!device) {
      return ack?.({
        success: false,
        message: "E2EE device ownership verification failed",
      });
    }

    // Remove any previous device-specific room on this socket.
    const previousDeviceId = socket.data.e2eeDeviceId;

    if (previousDeviceId) {
      socket.leave(
        `e2ee-${senderId}-${previousDeviceId}`
      );
    }

    const room = `e2ee-${senderId}-${device.deviceId}`;

    socket.join(room);

    socket.data.e2eeDeviceId = device.deviceId;

    console.log("[E2EE] Socket bound to device:", {
      userId: senderId,
      deviceId: device.deviceId,
      socketId: socket.id,
      registered: device.registered,
    });

    ack?.({
      success: true,
      deviceId: device.deviceId,
    });
  } catch (error) {
    console.error("[E2EE] Device binding failed:", error);

    ack?.({
      success: false,
      message: "Unable to bind E2EE device",
    });
  }
});

  // -------------------------------
  // User presence
  // -------------------------------
  try {
    await redisClient.sAdd("online-users", senderId);

    const onlineUsers = await redisClient.sMembers("online-users");

    io.emit("user-online", senderId);
    socket.emit("online-users", onlineUsers);
  } catch (err) {
    console.error("Presence initialization error:", err);
  }

  // -------------------------------
  // Join chat room
  // -------------------------------
  socket.on("join_chat", async (chatId, ack) => {
    try {
      if (!mongoose.isValidObjectId(chatId)) {
        return ack?.({ success: false, message: "Invalid chat ID" });
      }

      const chat = await Chat.findById(chatId)
        .select("participants status")
        .lean();

      const isParticipant = chat?.participants?.some(
        (id) => id.toString() === senderId
      );

      if (!chat || !isParticipant || chat.status === "declined") {
        return ack?.({
          success: false,
          message: "Chat access denied",
        });
      }

      socket.join(chatId.toString());

      ack?.({ success: true });

    } catch (err) {
      console.error("join_chat error:", err);
      ack?.({ success: false, message: "Unable to join chat" });
    }
  });

  // -------------------------------
  // Leave chat room
  // -------------------------------
  socket.on("leave_chat", async (chatId, ack) => {
    try {
      if (!mongoose.isValidObjectId(chatId)) {
        return ack?.({ success: false, message: "Invalid chat ID" });
      }

      const chat = await Chat.findById(chatId)
        .select("participants")
        .lean();

      const isParticipant = chat?.participants?.some(
        (id) => id.toString() === senderId
      );

      if (!chat || !isParticipant) {
        return ack?.({
          success: false,
          message: "Chat access denied",
        });
      }

      socket.leave(chatId.toString());

      ack?.({ success: true });

    } catch (err) {
      console.error("leave_chat error:", err);
      ack?.({ success: false, message: "Unable to leave chat" });
    }
  });

  // -------------------------------
  // Send encrypted message
  // -------------------------------
  socket.on("send-message", async (msg, ack) => {
    try {
      if (!msg || typeof msg !== "object") {
        return ack?.({
          success: false,
          message: "Invalid message",
        });
      }

      const {
        chatId,
        receiverId: requestedReceiverId,
        encryptedPayload,
        encryption,
        messageType = "text",
        mediaUrl = null,
        mediaType = null,
        replyTo = null,
        tempId,
      } = msg;

      // Never accept plaintext or legacy media keys.
      if (
        Object.hasOwn(msg, "text") ||
        Object.hasOwn(msg, "mediaKey") ||
        Object.hasOwn(msg, "sharedPostId")
      ) {
        return ack?.({
          success: false,
          message: "Plaintext messages are not supported",
        });
      }

      // Validate Signal envelope.
      if (
        encryption?.protocol !== "signal" ||
        encryption?.version !== 1 ||
        typeof encryptedPayload?.ciphertext !== "string" ||
        !encryptedPayload.ciphertext.length ||
        Buffer.byteLength(encryptedPayload.ciphertext, "utf8") > 1024 * 1024 ||
        !["SignalMessage", "PreKeySignalMessage"].includes(
          encryptedPayload.signalType
        ) ||
        typeof encryptedPayload.deviceId !== "string" ||
        !encryptedPayload.deviceId.trim()
      ) {
        return ack?.({
          success: false,
          message: "Invalid encrypted message payload",
        });
      }

      if (!["text", "media", "post"].includes(messageType)) {
        return ack?.({
          success: false,
          message: "Invalid message type",
        });
      }

      if (messageType === "media") {
        if (
          typeof mediaUrl !== "string" ||
          !mediaUrl ||
          !["image", "video"].includes(mediaType)
        ) {
          return ack?.({
            success: false,
            message: "Invalid encrypted media details",
          });
        }
      } else if (mediaUrl || mediaType) {
        return ack?.({
          success: false,
          message: "Media details are only allowed for media messages",
        });
      }

      let chat = null;
      let isNewChat = false;
      let finalChatId;

      // -------------------------------
      // Find or create chat
      // -------------------------------
      if (chatId) {
        if (!mongoose.isValidObjectId(chatId)) {
          return ack?.({
            success: false,
            message: "Invalid chat ID",
          });
        }

        chat = await Chat.findById(chatId)
          .select("participants status")
          .lean();

        const isParticipant = chat?.participants?.some(
          (id) => id.toString() === senderId
        );

        if (!chat || !isParticipant) {
          return ack?.({
            success: false,
            message: "Chat not found or access denied",
          });
        }

      } else {
        // receiverId is only used when creating/finding a new chat.
        if (
          !mongoose.isValidObjectId(requestedReceiverId) ||
          requestedReceiverId.toString() === senderId
        ) {
          return ack?.({
            success: false,
            message: "Invalid recipient",
          });
        }

        const recipient = await User.findById(requestedReceiverId)
          .select("_id")
          .lean();

        if (!recipient) {
          return ack?.({
            success: false,
            message: "Recipient not found",
          });
        }

        const participants = [senderId, requestedReceiverId.toString()].sort();
        const chatKey = participants.join("_");

        chat = await Chat.findOne({ chatKey })
          .select("participants status")
          .lean();

        if (!chat) {
          try {
            chat = await Chat.create({
              participants,
              chatKey,
              requestedBy: senderId,
              status: "pending",
            });

            isNewChat = true;

          } catch (createError) {
            // Handle a possible concurrent chat creation.
            if (createError.code !== 11000) {
              throw createError;
            }

            chat = await Chat.findOne({ chatKey })
              .select("participants status")
              .lean();
          }
        }
      }

      if (!chat) {
        return ack?.({
          success: false,
          message: "Unable to resolve chat",
        });
      }

      if (chat.status === "declined") {
        return ack?.({
          success: false,
          message: "This chat has been declined",
        });
      }

      if (chat.participants.length !== 2) {
        return ack?.({
          success: false,
          message: "Only one-to-one chats are supported",
        });
      }

      finalChatId = chat._id.toString();

      // Derive recipient from the actual chat participants.
      const receiverId = chat.participants.find(
        (id) => id.toString() !== senderId
      )?.toString();

      if (!receiverId) {
        return ack?.({
          success: false,
          message: "Unable to resolve recipient",
        });
      }

      // Join the sender to the authorized chat room.
      socket.join(finalChatId);

      // -------------------------------
      // Notify about a newly created chat
      // -------------------------------
      if (isNewChat) {
        try {
          await sendEventToQueue({
            type: "CHAT_REQUEST",
            actorId: senderId,
            recipientId: receiverId,
            chatId: chat._id,
            createdAt: new Date(),
          });
        } catch (queueError) {
          console.error("Chat request queue error:", queueError);
        }

        const sender = await User.findById(senderId)
          .select("_id username avatar")
          .lean();

        if (sender) {
          io.to(`user-${receiverId}`).emit("new-chat-request", {
            chatId: finalChatId,
            status: chat.status,
            requestedBy: senderId,
            user: {
              id: sender._id,
              name: sender.username,
              avatar: sender.avatar || "",
            },
          });
        }
      }

      // -------------------------------
      // Resolve reply target
      // Store IDs only, never plaintext preview.
      // -------------------------------
      let resolvedReplyTo = null;

      if (replyTo?.messageId) {
        if (!mongoose.isValidObjectId(replyTo.messageId)) {
          return ack?.({
            success: false,
            message: "Invalid reply message ID",
          });
        }

        const repliedMessage = await Message.findOne({
          _id: replyTo.messageId,
          chatId: finalChatId,
        })
          .select("_id senderId")
          .lean();

        if (!repliedMessage) {
          return ack?.({
            success: false,
            message: "Reply message not found",
          });
        }

        resolvedReplyTo = {
          messageId: repliedMessage._id,
          senderId: repliedMessage.senderId,
        };
      }

      // -------------------------------
      // Save encrypted message
      // -------------------------------
      const message = await Message.create({
        chatId: finalChatId,
        senderId,
        receiverId,

        encryptedPayload,
        encryption,

        messageType,
        mediaUrl,
        mediaType,

        replyTo: resolvedReplyTo,
        seen: false,
      });

      // -------------------------------
      // Invalidate legacy Redis cache
      // Do not cache plaintext messages.
      // -------------------------------
      try {
        await redisClient.del(`chat:messages:${finalChatId}`);
      } catch (cacheError) {
        console.error("Chat cache invalidation error:", cacheError);
      }

      // -------------------------------
      // Emit encrypted message
      // -------------------------------
      const messageData = {
        _id: message._id,
        tempId,
        chatId: finalChatId,
        senderId,
        receiverId,

        encryptedPayload: message.encryptedPayload,
        encryption: message.encryption,

        messageType,
        mediaUrl,
        mediaType,

        replyTo: message.replyTo || null,
        seen: false,
        createdAt: message.createdAt,
      };

      io.to(finalChatId).emit("receive-message", messageData);

      io.to(`user-${receiverId}`).emit("new-unread-message", {
        senderId,
        chatId: finalChatId,
      });

      ack?.({
        success: true,
        chatId: finalChatId,
        message: messageData,
      });

    } catch (err) {
      console.error("Encrypted send-message error:", err);

      ack?.({
        success: false,
        message: "Failed to send encrypted message",
      });
    }
  });

  // -------------------------------
  // Legacy post event
  // -------------------------------
  // Post IDs must now be inside the encrypted payload.
  socket.on("send_post", (_data, ack) => {
    ack?.({
      success: false,
      message: "Use send-message with messageType 'post' and an encrypted payload",
    });
  });

  // -------------------------------
  // Delete message
  // -------------------------------
  socket.on("delete-message", async ({ messageId }, ack) => {
    try {
      if (!mongoose.isValidObjectId(messageId)) {
        return ack?.({
          success: false,
          message: "Invalid message ID",
        });
      }

      const message = await Message.findById(messageId);

      if (!message) {
        return ack?.({
          success: false,
          message: "Message not found",
        });
      }

      if (message.senderId.toString() !== senderId) {
        return ack?.({
          success: false,
          message: "You cannot delete this message",
        });
      }

      const chatId = message.chatId.toString();

      await Message.findByIdAndDelete(messageId);

      try {
        await redisClient.del(`chat:messages:${chatId}`);
      } catch (cacheError) {
        console.error("Delete cache invalidation error:", cacheError);
      }

      io.to(chatId).emit("message-deleted", {
        messageId,
        chatId,
      });

      ack?.({ success: true });

    } catch (err) {
      console.error("Delete message error:", err);

      ack?.({
        success: false,
        message: "Failed to delete message",
      });
    }
  });

  // -------------------------------
  // Disconnect / presence cleanup
  // -------------------------------
  socket.on("disconnect", async () => {
    try {
      const sockets = await io
        .in(`user-${senderId}`)
        .fetchSockets();

      if (sockets.length === 0) {
        await redisClient.sRem("online-users", senderId);
        io.emit("user-offline", senderId);
      }
    } catch (err) {
      console.error("Disconnect presence error:", err);
    }

    console.log("Socket disconnected:", socket.id);
  });
});


// ============================================
// STARTUP & INITIALIZATION
// ============================================
(async () => {
  try {
    //  Connect Redis clients (if not already connected)
    console.log("Ensuring Redis clients are connected...");

    if (!redisClient.isOpen) {
      console.log("Connecting main Redis client...");
      // Your existing redis.js already connects, but this ensures it
    }

    if (!redisIoPubClient.isOpen) {
      await redisIoPubClient.connect();
      console.log("✅ Redis IO Pub Client connected");
    }

    if (!redisIoSubClient.isOpen) {
      await redisIoSubClient.connect();
      console.log("✅ Redis IO Sub Client connected");
    }

    dns.setServers(["1.1.1.1", "8.8.8.8"]);
    //  Connect MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 20000,
    });
    console.log("✅ MongoDB Connected");

    await initGeoService();

    //  Initialize PubSub for SSE
    await initializeSessionPubSub();
    console.log("✅ Session PubSub initialized");

    //  Start cleanup worker
    startCleanupWorker();

    //  Start HTTP server
    server.listen(PORT, () => {
      console.log(`[Backend ${process.env.INSTANCE_ID || 'default'}] 🚀 Server running on port ${PORT}`);
    });

    // 5️⃣ Graceful shutdown
    process.on("SIGTERM", async () => {
      console.log("SIGTERM received, shutting down gracefully...");
      server.close();
      await mongoose.disconnect();
      await Promise.all([
        redisClient.quit(),
        redisIoPubClient.quit(),
        redisIoSubClient.quit(),
      ]).catch(() => { });
      process.exit(0);
    });

  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
})();