import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import "./passportConfig.js"

import http from "http";
import { Server } from "socket.io";
import GameSession from "./models/GameSession.js";
import fetch from "node-fetch";
import { releaseInstance } from "./services/instanceAllocator.js";
import { sessionStreams } from "./services/sessionStream.js";
import { initializeSessionPubSub } from "./services/sessionPubSub.js";

// ROUTES
import modelUploadRouter from "./routes/compression.js";
import internalNotificationRoutes from "./routes/internalNotification.js";
import chatMediaUpload from "./routes/chatMediaUpload.js";
import deviceMiddleware from "./middlewares/deviceMiddleware.js";
import ArticleRoutes from "./routes/articlesRoutes.js";
import allPostRoutes from "./routes/allPosts.js";
import gameStatus from "./routes/gameStatus.js"
import authRoutes from "./routes/auth.js";
import adRoutes from "./routes/adRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import meRoutes from "./routes/me.js";
import chatRoutes from "./routes/chatRoutes.js";
import Chat from "./models/Chat.js";
import messageRoutes from "./routes/messageRoutes.js";
import feedBackRoutes from "./routes/feedback.js";
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
import streamProxyRouter, { handleWsUpgrade } from "./routes/streamProxy.js";

import adminRouter from "./routes/admin.js"


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
  const host = req.headers.host?.split(":")[0];

  if (host?.endsWith(".stream.rigzer.com")) {
    return streamProxyRouter(req, res, next);
  }

  next();
});

// EXPRESS CORS
const corsWhitelist = [
  "http://localhost:5173",
  "https://localhost:5173",
  "https://xn--tlay-0ra.com",
  "https://www.rigzer.com",
  "https://rigzer.com",
  "https://gamesocial-git-feature-asg-wadkar-naveds-projects-6bc20af1.vercel.app",
  "https://stream.rigzer.com",
  /^https:\/\/.*\.stream\.rigzer\.com$/,
  process.env.FRONTEND_URL
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = corsWhitelist.some(entry =>
        typeof entry === "string"
          ? entry === origin
          : entry.test(origin)
      );
      if (allowed || origin.endsWith(".devtunnels.ms")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.set("trust proxy", 1);
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));


app.use(cookieParser());
app.use(deviceMiddleware)
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());


// ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/likes", likesRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/users", userRoutes);
app.use("/api/devlogs", devlogsRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/articles", ArticleRoutes);
app.use("/api/allposts", allPostRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/me", meRoutes);
app.use("/api/game", gameStatus);
app.use("/uploads", express.static("uploads"));
app.use("/api/ads", adRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/media/upload", chatMediaUpload);
app.use("/api/wishlist", wishListRoutes);
app.use("/api/gameRoutes", gameRoutes);
// app.use("/api/interactions", interactionRoutes);
app.use("/api/feedback", feedBackRoutes);
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

// Admin routes (protected by your isAdmin middleware)
app.use("/api/admin", adminRouter);

// HTTP SERVER
const server = http.createServer(app);

server.on("upgrade", (req, socket, head) => {
  const host = req.headers.host?.split(":")[0];

  if (host?.endsWith(".stream.rigzer.com")) {
    handleWsUpgrade(req, socket, head);
  }
});

// SOCKET.IO (Real-Time Chat)
const io = new Server(server, {
  cors: {
    origin: corsWhitelist,
    credentials: true,
  },
});

let onlineUsers = new Map(); // userId => Set(socketId)
app.use("/api/internal-notify", internalNotificationRoutes(io, onlineUsers));
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join", (userId) => {
    socket.userId = userId; // attach to socket for cleanup
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }

    onlineUsers.get(userId).add(socket.id);
    console.log("User joined:", userId);
    // 🔥 Emit to everyone that this user is online
    io.emit("user-online", userId);

    // 🔥 Send full list to newly connected socket
    socket.emit("online-users", Array.from(onlineUsers.keys()));
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
    const { chatId, senderId, receiverId, postId } = data;
    if (!chatId) {
      console.log("Creating new chat");
      const participants = [senderId, receiverId].sort();

      let chat = await Chat.findOne({ participants });
      if (!chat) {
        chat = await Chat.create({ participants });
      }

      chatId = chat._id;
    }
    const message = await Message.create({
      chatId,
      receiverId,
      senderId,
      messageType: "post",
      sharedPostId: postId,
    });

    const messageData = {
      _id: message._id,
      chatId,
      senderId,
      receiverId,
      messageType: "post",
      sharedPostId: postId,
      createdAt: message.createdAt,
    };

    // emit to chat room
    io.to(chatId).emit("receive-message", messageData);
    // ✅ 2. Badge update only if receiver not inside room
    const roomSockets = io.sockets.adapter.rooms.get(chatId);
    const receiverSockets = onlineUsers.get(receiverId);

    if (receiverSockets) {
      receiverSockets.forEach((socketId) => {
        if (!roomSockets || !roomSockets.has(socketId)) {
          io.to(socketId).emit("new-unread-message", {
            senderId,
            chatId,
          });
        }
      });
    }
  });

  // normal message
  socket.on("send-message", async (msg) => {
    let { chatId, senderId, receiverId, text, mediaUrl, mediaType } = msg;
    if (!chatId) {
      console.log("Creating new chat");
      const participants = [senderId, receiverId].sort();

      let chat = await Chat.findOne({ participants });
      if (!chat) {
        chat = await Chat.create({ participants });
      }

      chatId = chat._id;
    }
    const message = await Message.create({
      chatId,
      senderId,
      receiverId,
      text,
      mediaUrl,
      mediaType,
      messageType: mediaUrl ? "media" : "text"
    });

    const messageData = {
      _id: message._id,
      chatId,
      senderId,
      receiverId,
      text,
      mediaUrl,
      mediaType,
      messageType: mediaUrl ? "media" : "text",
      createdAt: message.createdAt,
    };
    // ✅ 1. Send message to active room
    io.to(chatId).emit("receive-message", messageData);
    // ✅ 2. Badge update only if receiver not inside room
    const roomSockets = io.sockets.adapter.rooms.get(chatId);
    const receiverSockets = onlineUsers.get(receiverId);
    console.log("receiverSockets", receiverSockets);
    if (receiverSockets) {
      receiverSockets.forEach((socketId) => {
        console.log("socketId of reveiverSockets", socketId);
        if (!roomSockets || !roomSockets.has(socketId)) {
          console.log("new-read message event fired for", socketId);
          io.to(socketId).emit("new-unread-message", {
            senderId,
            chatId,
          });
        }
      });
    }

  });

  socket.on("disconnect", () => {
    const userId = socket.userId;
    if (!userId) return;

    const sockets = onlineUsers.get(userId);

    if (!sockets) return;

    sockets.delete(socket.id);

    if (sockets.size === 0) {
      onlineUsers.delete(userId);

      // 🔥 Emit offline only if ALL devices disconnected
      io.emit("user-offline", userId);
    }

    console.log("Socket disconnected:", socket.id);
  });

});


// ✅ Replace with
(async () => {
  try {
    // 1️⃣ Connect Mongo FIRST
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 20,       // default is 5 — too low for 200 VUs
      minPoolSize: 5,        // keep connections warm
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 20000,
    });
    console.log("MongoDB Connected");

    // 2️⃣ Initialize pubsub
    await initializeSessionPubSub();

    // 3️⃣ Start HTTP server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // 4️⃣ Stale session cleanup
    setInterval(async () => {
      try {
        const staleThreshold = new Date(Date.now() - 90_000);

        const staleSessions = await GameSession.find({
          status: { $in: ["waiting", "starting", "running"] },
          lastHeartbeat: { $lt: staleThreshold },
        }).lean();

        for (const session of staleSessions) {
          console.log(`[Cleanup] Stale session: ${session._id}`);

          if (session.instanceIp) {
            fetch(`http://${session.instanceIp}:4443/stop-session`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session_id: session._id.toString() }),
            }).catch(() => { });
          }

          await GameSession.findByIdAndUpdate(session._id, {
            status: "ended",
            endedAt: new Date(),
            exitReason: "stale_abandoned",
          });

          if (session.instanceId && session.leaseToken) {
            releaseInstance(session.instanceId, session.leaseToken).catch(() => { });
          }
        }
      } catch (err) {
        console.error("[Cleanup] Error:", err);
      }
    }, 60_000);

  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
})();
