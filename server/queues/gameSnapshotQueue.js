import { Queue } from "bullmq";
import { redisConfig } from "../config/redis.js";

console.log("[gameSnapshotQueue] Initializing queue: game-snapshot");

export const gameSnapshotQueue = new Queue(
  "game-snapshot",
  {
    connection: redisConfig,
  }
);

console.log("[gameSnapshotQueue] Queue initialized");