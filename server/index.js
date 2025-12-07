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

// ROUTES
import modelUploadRouter from "./routes/compression.js";
import chatMediaUpload from "./routes/chatMediaUpload.js";
import gameStatus from "./routes/gameStatus.js"
import authRoutes from "./routes/auth.js";
import adRoutes from "./routes/adRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import meRoutes from "./routes/me.js";
import chatRoutes from "./routes/chatRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import feedBackRoutes from "./routes/feedback.js";
import commentRoutes from "./routes/comment.js";
import gameRoutes from "./routes/gameRoutes.js";
import interactionRoutes from "./routes/interactions.js"
import gameZip from "./routes/game.js";
import devlogsRoutes from "./routes/devlogs.js";
import likesRoutes from "./routes/likes.js";
import userRoutes from "./routes/userRoutes.js";
import metadataRoutes from "./routes/metadata.js";
import gameFetch from "./routes/gameFetch.js";
import recommendationRoutes from "./routes/recommendation.js";
import wishListRoutes from "./routes/wishListRoutes.js";
import Message from "./models/Message.js";
import searchRoutes from "./routes/searchRoutes.js";
import followRoutes from "./routes/followRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// EXPRESS CORS
const corsWhitelist = [
  "http://localhost:5173",
  "https://localhost:5173",
  "https://xn--tlay-0ra.com",
  process.env.FRONTEND_URL
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        corsWhitelist.includes(origin) ||
        origin.endsWith(".devtunnels.ms")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
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
app.use("/api/messages", messageRoutes);
app.use("/api/me", meRoutes);
app.use("/api/game", gameStatus);
app.use("/uploads", express.static("uploads"));
app.use("/api/ads", adRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/media/upload", chatMediaUpload);
app.use("/api/wishlist", wishListRoutes);
app.use("/api/gameRoutes", gameRoutes);
app.use("/api/interactions", interactionRoutes);
app.use("/api/feedback", feedBackRoutes);
app.use("/api/recommend", recommendationRoutes);
app.use("/api/compression", modelUploadRouter);
app.use("/api/gameupload", gameZip);
app.use("/api/games", gameFetch);
app.use("/api/metadata", metadataRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/search", searchRoutes);

// HTTP SERVER
const server = http.createServer(app);

// SOCKET.IO (Real-Time Chat)
const io = new Server(server, {
  cors: {
    origin: corsWhitelist,
    credentials: true,
  },
});

let onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join", (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log("User joined:", userId);
  });

  socket.on("send-message", async (msg) => {
  const { chatId, senderId, receiverId, text, mediaUrl, mediaType } = msg;

  const message = await Message.create({
    chatId,
    senderId,
    text,
    mediaUrl,
    mediaType,
  });

  const messageData = {
    _id: message._id,
    chatId,
    senderId,
    receiverId,
    text,
    mediaUrl,
    mediaType,
    createdAt: message.createdAt,
  };

  const receiverSocket = onlineUsers.get(receiverId);
  if (receiverSocket) {
    io.to(receiverSocket).emit("receive-message", messageData);
  }

  // always return to sender also
  const senderSocket = onlineUsers.get(senderId);
  if (senderSocket) {
    io.to(senderSocket).emit("receive-message", messageData);
  }
});



  // Cleanup on disconnect
  socket.on("disconnect", () => {
    for (let [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) onlineUsers.delete(uid);
    }
  });
});

// MONGO
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Connection Error:", err));

// START SERVER
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
