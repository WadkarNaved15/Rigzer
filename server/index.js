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

import streamProxyRouter, { handleWsUpgrade } from "./routes/streamProxy.js";
import adminCreditsRoutes from "./routes/adminCredits.js";
import adminSessionRouter from "./routes/adminSessionMonitoring.js";
import adminIntelligenceRouter from "./routes/adminIntelligence.js";
import AdminSponsoredGamesRouter from "./routes/adminSponsoredGames.js";

import RazorpayWebhookRouter from "./routes/razorpayWebhook.js";

import adminRouter from "./routes/admin.js"

dotenv.config();

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

// Attach Redis adapter to Socket.IO
// This makes io.to(chatId).emit() and room membership work across all backends
io.adapter(createAdapter(redisIoPubClient, redisIoSubClient));

app.use("/api/internal-notify", internalNotificationRoutes(io));

// ============================================
// SOCKET.IO EVENT HANDLERS
// ============================================
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Join user presence
  socket.on("join", async (userId) => {
    socket.userId = userId;
    socket.join(`user-${userId}`);

    // Add to Redis presence set
    try {
      await redisClient.sAdd(`online-users`, userId);
      const onlineUsers = await redisClient.sMembers(`online-users`);

      console.log("User joined:", userId);

      // Emit to everyone that this user is online
      io.emit("user-online", userId);

      // Send full list to newly connected socket
      socket.emit("online-users", onlineUsers);
    } catch (err) {
      console.error("Error adding user to presence:", err);
    }
  });

  // Join chat room
  socket.on("join_chat", (chatId) => {
    socket.join(chatId);
    console.log("Joined chat room:", chatId);
  });

  // Leave chat room
  socket.on("leave_chat", (chatId) => {
    socket.leave(chatId);
    console.log("Left chat room:", chatId);
  });

  // Send Post
  socket.on("send_post", async (data) => {
    try {
      const { chatId, senderId, receiverId, postId } = data;

      let finalChatId = chatId;
      let chat = null;
      let isNewChat = false;

      // ----------------------------------------
      // Find or create chat
      // ----------------------------------------
      if (!finalChatId) {
        const participants = [senderId, receiverId].sort();
        const chatKey = participants.join("_");

        chat = await Chat.findOne({ chatKey }).lean();

        if (!chat) {
          chat = await Chat.create({
            participants,
            chatKey,
            requestedBy: senderId,
            status: "pending",
          });

          isNewChat = true;

          await sendEventToQueue({
            type: "CHAT_REQUEST",
            actorId: senderId,
            recipientId: receiverId,
            chatId: chat._id,
            createdAt: new Date(),
          });
        }

        finalChatId = chat._id;
        socket.join(finalChatId.toString());
        console.log("Joined chat room:", finalChatId);
      } else {
        // Existing chat → fetch only what we need
        chat = await Chat.findById(finalChatId)
          .select("status")
          .lean();
      }

      // ----------------------------------------
      // Save message
      // ----------------------------------------
      const message = await Message.create({
        chatId: finalChatId,
        receiverId,
        senderId,
        messageType: "post",
        sharedPostId: postId,
      });

      if (isNewChat) {
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

      // ----------------------------------------
      // Emit message
      // ----------------------------------------
      const messageData = {
        _id: message._id,
        chatId: finalChatId,
        senderId,
        receiverId,
        messageType: "post",
        sharedPostId: postId,
        createdAt: message.createdAt,
      };
      const cacheKey = `chat:messages:${finalChatId}`;
      try {
        const pipeline = redisClient.multi();

        // Add newest message
        pipeline.rPush(cacheKey, JSON.stringify(messageData));

        // Keep only the latest 31 messages
        pipeline.lTrim(cacheKey, -31, -1);

        // Refresh cache expiry
        pipeline.expire(cacheKey, 60 * 60 * 6);

        await pipeline.exec();
      } catch (err) {
        console.error("Redis chat cache update failed:", err);
      }

      io.to(finalChatId).emit("receive-message", messageData);

      // ----------------------------------------
      // Emit unread badge
      // ----------------------------------------
      if (chat?.status !== "declined") {
        const receiverOnline = await redisClient.sIsMember(
          "online-users",
          receiverId
        );

        if (receiverOnline) {
          io.to(`user-${receiverId}`).emit("new-unread-message", {
            senderId,
            chatId: finalChatId,
          });
        }
      }
    } catch (err) {
      console.error("send_post error:", err);
    }
  });

  // Normal message
  socket.on("send-message", async (msg, ack) => {
    try {
      let {
        chatId,
        senderId,
        receiverId,
        text,
        mediaUrl,
        mediaKey,
        mediaType,
        replyTo,
        tempId,
      } = msg;

      let finalChatId = chatId;
      let chat = null;
      let isNewChat = false;

      // ----------------------------------------
      // Find or create chat
      // ----------------------------------------
      if (!finalChatId) {
        const participants = [senderId, receiverId].sort();
        const chatKey = participants.join("_");

        chat = await Chat.findOne({ chatKey }).lean();

        if (!chat) {
          chat = await Chat.create({
            participants,
            chatKey,
            requestedBy: senderId,
            status: "pending",
          });

          isNewChat = true;

          await sendEventToQueue({
            type: "CHAT_REQUEST",
            actorId: senderId,
            recipientId: receiverId,
            chatId: chat._id,
            createdAt: new Date(),
          });
        }

        finalChatId = chat._id;
        socket.join(finalChatId.toString());
        console.log("Joined chat room:", finalChatId);
      } else {
        // Existing chat → fetch only the fields we actually need
        chat = await Chat.findById(finalChatId)
          .select("status")
          .lean();
      }

      // Tell the sender the authoritative chat ID
      if (typeof ack === "function") {
        ack({
          success: true,
          chatId: finalChatId.toString(),
        });
      }

      // ----------------------------------------
      // Resolve and validate reply
      // ----------------------------------------
      let resolvedReplyTo = null;

      if (replyTo?.messageId) {
        // Validate ObjectId before querying MongoDB
        if (!mongoose.isValidObjectId(replyTo.messageId)) {
          console.warn("Invalid reply message ID:", replyTo.messageId);

          return;
        }

        const repliedMessage = await Message.findOne({
          _id: replyTo.messageId,
          chatId: finalChatId,
        })
          .select(
            "_id senderId text messageType mediaType mediaUrl"
          )
          .lean();

        // The replied message must belong to the same chat.
        if (!repliedMessage) {
          console.warn(
            "Reply target not found or does not belong to this chat:",
            replyTo.messageId
          );

          return;
        }

        resolvedReplyTo = {
          messageId: repliedMessage._id,
          senderId: repliedMessage.senderId,
          text: repliedMessage.text || null,
          messageType: repliedMessage.messageType || "text",
          mediaType: repliedMessage.mediaType || null,
          mediaUrl: repliedMessage.mediaUrl || null,
        };
      }

      // ----------------------------------------
      // Save message
      // ----------------------------------------
      const message = await Message.create({
        chatId: finalChatId,
        senderId,
        receiverId,
        text,
        mediaUrl,
        mediaKey,
        mediaType,
        messageType: mediaUrl ? "media" : "text",
        replyTo: resolvedReplyTo,
      });

      if (isNewChat) {
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

      // ----------------------------------------
      // Emit message
      // ----------------------------------------
      const messageData = {
        _id: message._id,
        tempId,
        chatId: finalChatId,
        senderId,
        receiverId,
        text,
        mediaUrl,
        mediaKey,
        mediaType,
        messageType: mediaUrl ? "media" : "text",
        replyTo: message.replyTo || null,
        createdAt: message.createdAt,
      };
      const cacheKey = `chat:messages:${finalChatId}`;

      try {
        const pipeline = redisClient.multi();

        // Add newest message
        pipeline.rPush(cacheKey, JSON.stringify(messageData));

        // Keep only latest 31 messages
        pipeline.lTrim(cacheKey, -31, -1);

        // Refresh cache expiry
        pipeline.expire(cacheKey, 60 * 60 * 6);

        await pipeline.exec();
      } catch (err) {
        console.error("Redis chat cache update failed:", err);
      }

      io.to(finalChatId).emit("receive-message", messageData);

      // ----------------------------------------
      // Emit unread badge
      // ----------------------------------------
      if (chat?.status !== "declined") {
        const receiverOnline = await redisClient.sIsMember(
          "online-users",
          receiverId
        );

        if (receiverOnline) {
          io.to(`user-${receiverId}`).emit("new-unread-message", {
            senderId,
            chatId: finalChatId,
          });
        }
      }
    } catch (err) {
      console.error("send-message error:", err);
    }
  });
  // Deletion of message
  socket.on("delete-message", async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);

      if (!message) return;

      // Security: only sender can delete
      if (message.senderId.toString() !== socket.userId) {
        console.log("Unauthorized delete attempt");
        return;
      }

      // Delete media from S3
      if (message.mediaKey) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: message.mediaKey,
          })
        );
      }

      const chatId = message.chatId;

      await Message.findByIdAndDelete(messageId);

      // Invalidate Redis cache for this chat
      await redisClient.del(`chat:messages:${chatId}`);

      io.to(chatId.toString()).emit("message-deleted", {
        messageId,
        chatId,
      });

      console.log("Message deleted:", messageId);
    } catch (err) {
      console.error("Delete message error:", err);
    }
  });
  // Disconnect
  socket.on("disconnect", async () => {
    const userId = socket.userId;
    if (!userId) return;

    try {
      // Check if this user has any other sockets connected
      const sockets = await io.in(`user-${userId}`).fetchSockets();

      if (sockets.length === 0) {
        // No more sockets for this user, remove from presence
        await redisClient.sRem(`online-users`, userId);
        io.emit("user-offline", userId);
      }
    } catch (err) {
      console.error("Error on disconnect:", err);
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