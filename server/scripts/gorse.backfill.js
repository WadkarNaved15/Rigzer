// scripts/gorse.backfill.js
// Run ONCE to push all existing users, posts, and interactions into Gorse.
// Usage: node scripts/gorse.backfill.js
//
// Safe to re-run — Gorse upserts are idempotent.
// Takes ~5-10 min for 10k posts; runs in batches to avoid memory spikes.

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import AllPost from "../models/Allposts.js";
import Like from "../models/Like.js";
import Wishlist from "../models/Wishlist.js";
import Comment from "../models/Comment.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { upsertUser, upsertItem, insertFeedback } from "../services/gorse.client.js";


dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const BATCH_SIZE = 100;   // items per batch — tune down if you hit memory limits
const DELAY_MS   = 100;   // pause between batches to avoid overwhelming Gorse

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runBatched(label, Model, query, transform) {
  let processed = 0;
  let lastId = null;

  while (true) {
    const batchQuery = lastId ? { ...query, _id: { $gt: lastId } } : query;
    const docs = await Model.find(batchQuery)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (!docs.length) break;

    await Promise.allSettled(docs.map(transform));
    processed += docs.length;
    lastId = docs[docs.length - 1]._id;
    console.log(`  [${label}] ${processed} processed...`);
    await sleep(DELAY_MS);
  }

  console.log(`  [${label}] ✓ ${processed} total`);
  return processed;
}

// ── Label builders ────────────────────────────────────────────────────────────
// Gorse uses labels to power tag-based similarity. Add as much signal as you can.

function labelsForPost(post) {
  const labels = [];
  labels.push(`type:${post.type}`);

  if (post.type === "game_post" && post.gamePost?.gameName) {
    labels.push("content:game");
    if (post.gamePost.engine) labels.push(`engine:${post.gamePost.engine.toLowerCase()}`);
    if (post.gamePost.platform) labels.push(`platform:${post.gamePost.platform}`);
  }

  if (post.type === "model_post") labels.push("content:3dmodel");
  if (post.type === "normal_post") labels.push("content:art");
  if (post.type === "devlog_post") labels.push("content:devlog");
  if (post.type === "canvas_article") labels.push("content:article");
  if (post.type === "ad_model_post") labels.push("content:ad");

  // Extract tags from description (hashtags like #unity #blender)
  if (post.description) {
    const tags = post.description.match(/#(\w+)/g) || [];
    tags.slice(0, 10).forEach((t) => labels.push(`tag:${t.slice(1).toLowerCase()}`));
  }

  return labels;
}

function categoriesForPost(post) {
  // Gorse categories let you filter recommendations by content type
  return [post.type];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔄 Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected\n");

  // ── 1. Users ──────────────────────────────────────────────────────────────
  console.log("👥 Syncing users...");
  await runBatched("users", User, {}, async (user) => {
    await upsertUser({ userId: user._id.toString() });
  });

  // ── 2. Posts (items) ──────────────────────────────────────────────────────
  console.log("\n📦 Syncing posts...");
  await runBatched(
    "posts",
    AllPost,
    { type: { $ne: "canvas_article" } },    // exclude articles if you don't want them recommended
    async (post) => {
      await upsertItem({
        postId: post._id.toString(),
        timestamp: post.createdAt,
        labels: labelsForPost(post),
        categories: categoriesForPost(post),
      });
    }
  );

  // ── 3. Likes ──────────────────────────────────────────────────────────────
  console.log("\n❤️  Syncing likes...");
  await runBatched("likes", Like, {}, async (like) => {
    await insertFeedback({
      feedbackType: "like",
      userId: like.user.toString(),
      postId: like.post.toString(),
      timestamp: like.createdAt,
    });
  });

  // ── 4. Saves (wishlist) ───────────────────────────────────────────────────
  console.log("\n🔖 Syncing saves...");
  await runBatched("saves", Wishlist, {}, async (save) => {
    await insertFeedback({
      feedbackType: "save",
      userId: save.user.toString(),
      postId: save.post.toString(),
      timestamp: save.createdAt,
    });
  });

  // ── 5. Comments ───────────────────────────────────────────────────────────
  console.log("\n💬 Syncing comments...");
  await runBatched("comments", Comment, {}, async (comment) => {
    await insertFeedback({
      feedbackType: "comment",
      userId: comment.user.toString(),
      postId: comment.post.toString(),
      timestamp: comment.createdAt,
    });
  });

  console.log("\n✅ Backfill complete! Gorse will start training within 2 hours.");
  console.log("   Watch the dashboard at http://localhost:8088 to monitor progress.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});