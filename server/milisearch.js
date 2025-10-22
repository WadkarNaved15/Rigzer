import mongoose from "mongoose";
import Post from "./models/Post.js";
import User from "./models/User.js";
import dotenv from "dotenv";
import { MeiliSearch } from "meilisearch";

dotenv.config();

// Initialize Meilisearch client
const client = new MeiliSearch({
  host: "http://127.0.0.1:7700",
  apiKey: "shahin124", // or use process.env.MEILI_KEY
});

const postsIndex = client.index("posts");

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected ✅");
  } catch (err) {
    console.error("MongoDB connection error ❌", err);
    process.exit(1);
  }
}

// Index all posts into Meilisearch
async function indexAllPosts() {
  try {
    const allPosts = await Post.find({})
      .populate("user", "username email")
      .lean();

    console.log("Found posts in MongoDB:", allPosts.length);

    if (allPosts.length === 0) {
      console.log("No posts found. Exiting...");
      return;
    }

    // Map posts for Meilisearch
    const documents = allPosts.map((post) => ({
      id: post._id.toString(),       // Meilisearch primary key
      _id: post._id.toString(),      // Keep MongoDB _id for frontend mapping
      description: post.description,
      media: post.media,
      type: post.type,
      gameUrl: post.gameUrl,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      user: {
        id: post.user._id.toString(),  // optional Meilisearch user key
        _id: post.user._id.toString(), // MongoDB user ID
        username: post.user.username,
        email: post.user.email,
      },
    }));

    console.log("Adding documents to Meilisearch...");

    const task = await postsIndex.addDocuments(documents);
    console.log("Task enqueued:", task);

    // Wait for task completion (Meilisearch JS v1+)
    const taskStatus = await client.tasks.waitForTask(task.taskUid);
    console.log("Task completed ✅", taskStatus);

  } catch (err) {
    console.error("Failed to index posts:", err);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed 🛑");
  }
}

// Run the script
(async () => {
  console.log("Connecting to MongoDB...");
  await connectDB();
  console.log("Starting indexing process...");
  await indexAllPosts();
})();
