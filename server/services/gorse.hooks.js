// services/gorse.hooks.js
// Call these from your existing route files wherever users/posts are created.
// All functions are fire-and-forget safe.

import { upsertUser, upsertItem, hideItem, fireAndForget } from "./gorse.client.js";

/**
 * Call this after a new user signs up.
 * Add this to your auth.js signup handler.
 *
 * Example:
 *   import { onUserCreated } from "../services/gorse.hooks.js";
 *   // after User.create(...)
 *   onUserCreated(user._id.toString());
 */
export function onUserCreated(userId) {
  console.log("Sending user to Gorse:", userId);
  fireAndForget(() => upsertUser({ userId }));
}

/**
 * Call this after a new post is created.
 * Add this to wherever your posts are saved (postRoutes.js, uploadRoutes.js, etc.)
 *
 * @param {{ postId: string, createdAt: Date, type: string, description?: string, gamePost?: object }} post
 *
 * Example:
 *   import { onPostCreated } from "../services/gorse.hooks.js";
 *   // after AllPost.create(...)
 *   onPostCreated(savedPost);
 */
export function onPostCreated(post) {
  console.log("Sending post to Gorse:", post._id.toString());
  const labels = buildLabels(post);
  const categories = [post.type];

  fireAndForget(() =>
    upsertItem({
      postId: post._id.toString(),
      timestamp: post.createdAt || new Date(),
      labels,
      categories,
    })
  );
}

/**
 * Call this when a post is deleted.
 * Hides the post from recommendations without removing its training history.
 *
 * Example:
 *   import { onPostDeleted } from "../services/gorse.hooks.js";
 *   onPostDeleted(postId);
 */
export function onPostDeleted(postId) {
  console.log("Hiding post from Gorse:", postId);
  fireAndForget(() => hideItem(postId));
}

// ── Internal label builder (mirrors backfill.js) ──────────────────────────────

function buildLabels(post) {
  const labels = [`type:${post.type}`];

  if (post.type === "game_post" && post.gamePost) {
    labels.push("content:game");
    if (post.gamePost.engine) labels.push(`engine:${post.gamePost.engine.toLowerCase()}`);
    if (post.gamePost.platform) labels.push(`platform:${post.gamePost.platform}`);
  }

  if (post.type === "model_post")    labels.push("content:3dmodel");
  if (post.type === "normal_post")   labels.push("content:art");
  if (post.type === "devlog_post")   labels.push("content:devlog");
  if (post.type === "canvas_article") labels.push("content:article");
  if (post.type === "ad_model_post") labels.push("content:ad");

  if (post.description) {
    const tags = post.description.match(/#(\w+)/g) || [];
    tags.slice(0, 10).forEach((t) => labels.push(`tag:${t.slice(1).toLowerCase()}`));
  }

  return labels;
}