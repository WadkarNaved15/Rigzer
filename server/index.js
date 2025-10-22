import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import modelUploadRouter from "./routes/compression.js";
import "./passportConfig.js"; // Import Passport Config
import authRoutes from "./routes/auth.js"; // Ensure the file extension is correct
import postRoutes from "./routes/postRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import feedBackRoutes from "./routes/feedback.js"
import gameRoutes from "./routes/gameRoutes.js"
import gameZip from "./routes/game.js"
import devlogsRoutes from "./routes/devlogs.js";
import gameFetch from "./routes/gameFetch.js";
import searchRoutes from "./routes/searchRoutes.js"
import followRoutes from "./routes/followRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow mobile/postman
    if (
      [
        "http://localhost:5173",
        "https://localhost:5173",
        "https://xn--tlay-0ra.com",
        process.env.FRONTEND_URL
      ].includes(origin) ||
      origin.endsWith(".devtunnels.ms")
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));



app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

app.use(cookieParser());
app.use(session({ secret: process.env.JWT_SECRET, resave: false, saveUninitialized: true }));
// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/devlogs", devlogsRoutes);
app.use("/api/follow", followRoutes);


// Serve uploaded games statically
app.use("/uploads", express.static("uploads"));

// Upload route
app.use("/api/upload", uploadRoutes);
app.use("/api/gameRoutes",gameRoutes);
app.use("/api/feedback",feedBackRoutes);
app.use("/api/compression", modelUploadRouter);
app.use("/api/gameupload", gameZip);
app.use("/api/games", gameFetch);
app.use("/api/search", searchRoutes);
// Connect to MongoDB

mongoose
  .connect(process.env.MONGO_URI) // Removed the "!" here
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Connection Error:", err));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
