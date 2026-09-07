import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

import { sqsClient } from "../config/sqsClient.js";
import AllPost from "../models/Allposts.js";
import PostViewEvent from "../models/postViewEvent.js";
import PostAnalytics from "../models/postAnalytics.js";

import {
  insertFeedback,
  fireAndForget,
} from "../services/gorse.client.js";

const QUEUE_URL = process.env.POST_VIEW_QUEUE_URL;

if (!QUEUE_URL) {
  throw new Error("POST_VIEW_QUEUE_URL is not set");
}

const WAIT_TIME_SECONDS = 20;
const MAX_MESSAGES = 10;
const POLL_DELAY_MS = 1000;

const ALLOWED_SOURCES = ["feed", "profile", "search", "direct", "share", "other"];
const ALLOWED_DEVICE_TYPES = ["desktop", "mobile", "tablet", "other"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeValue = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

async function processViewMessage(message) {
  const payload = JSON.parse(message.Body || "{}");

  const {
    postId,
    viewerId,
    source = "other",
    deviceType = "other",
    watchTimeMs = 0,
    viewedAt = new Date().toISOString(),
  } = payload;

  if (!postId || !viewerId) {
    throw new Error("Invalid payload: postId and viewerId are required");
  }

  const alreadyViewed = await PostViewEvent.exists({
    post: postId,
    viewer: viewerId,
  });

  const isUnique = !alreadyViewed;

  const dateKey = new Date(viewedAt).toISOString().split("T")[0];
  const watchTime = Number(watchTimeMs) || 0;

  const safeSource = normalizeValue(source, ALLOWED_SOURCES, "other");
  const safeDeviceType = normalizeValue(deviceType, ALLOWED_DEVICE_TYPES, "other");

  // ── 1. AllPost counters ──────────────────────────────────────────────────
  await AllPost.updateOne(
    { _id: postId },
    {
      $inc: {
        viewsCount: 1,
        ...(isUnique ? { uniqueViewsCount: 1 } : {}),
      },
    }
  );

  // ── 2. Raw event log ─────────────────────────────────────────────────────
  await PostViewEvent.create({
    post: postId,
    viewer: viewerId,
    source: safeSource,
    deviceType: safeDeviceType,
    watchTimeMs: watchTime,
    isUnique: Boolean(isUnique),
    viewedAt: new Date(viewedAt),
  });

  // ── 3. PostAnalytics top-level + lifetime ────────────────────────────────
  //
  // FIX: Previously avgWatchTimeMs was computed from the pre-update
  // `analytics` variable (stale). Now we do a second targeted $set after
  // the increment so we always use the freshest totals.
  //
  const updated = await PostAnalytics.findOneAndUpdate(
    { post: postId },
    {
      $inc: {
        totalViews: 1,
        totalWatchTimeMs: watchTime,
        ...(isUnique ? { uniqueViews: 1 } : {}),
        [`viewsBySource.${safeSource}`]: 1,
        [`viewsByDevice.${safeDeviceType}`]: 1,

        // lifetime block mirrors top-level counters
        "lifetime.views": 1,
        "lifetime.watchTimeMs": watchTime,
        ...(isUnique ? { "lifetime.uniqueViews": 1 } : {}),
      },
      $set: { lastViewedAt: new Date(viewedAt) },
      $setOnInsert: { dailyStats: [] },
    },
    { upsert: true, new: true }   // `new: true` → returns UPDATED document
  );

  // ── 4. Recalculate avgWatchTimeMs from the freshly-updated totals ────────
  //
  // FIX: `updated` is the post-increment document so the division is correct.
  //
  const newAvg =
    updated.totalViews > 0
      ? Math.round(updated.totalWatchTimeMs / updated.totalViews)
      : 0;

  await PostAnalytics.updateOne(
    { post: postId },
    {
      $set: {
        avgWatchTimeMs: newAvg,
        "lifetime.avgWatchTimeMs": newAvg,
      },
    }
  );

  // ── 5. dailyStats upsert ─────────────────────────────────────────────────
  const dailyResult = await PostAnalytics.updateOne(
    { post: postId, "dailyStats.date": dateKey },
    {
      $inc: {
        "dailyStats.$.views": 1,
        "dailyStats.$.watchTimeMs": watchTime,
        ...(isUnique ? { "dailyStats.$.uniqueViews": 1 } : {}),
      },
    }
  );

  if (dailyResult.matchedCount === 0) {
    // Guard: only push if the date doesn't exist yet (avoids duplicates
    // under high concurrency — worst case we get two entries for the same
    // day, which the analytics route can handle by summing).
    await PostAnalytics.updateOne(
      {
        post: postId,
        "dailyStats.date": { $ne: dateKey },
      },
      {
        $push: {
          dailyStats: {
            date: dateKey,
            views: 1,
            uniqueViews: isUnique ? 1 : 0,
            watchTimeMs: watchTime,
            likes: 0,
            comments: 0,
            demoConsumptions: 0,
            sessions: 0,
            sessionPlayTimeMs: 0,
            uniquePlayers: 0,
          },
        },
      }
    );
  }
  console.log("Sending served feedback to Gorse:", postId, viewerId, viewedAt);
  fireAndForget(() =>
    insertFeedback({
      feedbackType: "served",
      userId: viewerId.toString(),
      postId: postId.toString(),
      timestamp: new Date(viewedAt),
    })
  );
}

async function deleteSqsMessage(receiptHandle) {
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: receiptHandle,
    })
  );
}

export async function startViewSQSConsumer() {
  console.log("✅ View worker started");

  while (true) {
    try {
      const response = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: MAX_MESSAGES,
          WaitTimeSeconds: WAIT_TIME_SECONDS,
          VisibilityTimeout: 60,
          AttributeNames: ["All"],
          MessageAttributeNames: ["All"],
        })
      );

      const messages = response.Messages || [];

      if (!messages.length) {
        await sleep(POLL_DELAY_MS);
        continue;
      }

      for (const message of messages) {
        try {
          await processViewMessage(message);
          await deleteSqsMessage(message.ReceiptHandle);
        } catch (err) {
          console.error("Failed to process post view message:", err);
        }
      }
    } catch (err) {
      console.error("SQS polling error:", err);
      await sleep(2000);
    }
  }
}