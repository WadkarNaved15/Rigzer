import { Worker } from "bullmq";
import { redisConfig } from "../config/redis.js";

import {
  SFNClient,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";

const awsRegion =
  process.env.AWS_REGION || "ap-south-1";

const stateMachineArn =
  process.env.GAME_SNAPSHOT_STATE_MACHINE_ARN;

const gameStorageBucket =
  process.env.AWS_BUCKET_NAME;

if (!stateMachineArn) {
  throw new Error(
    "[gameSnapshotWorker] GAME_SNAPSHOT_STATE_MACHINE_ARN is not configured"
  );
}

if (!gameStorageBucket) {
  throw new Error(
    "[gameSnapshotWorker] AWS_BUCKET_NAME is not configured"
  );
}

console.log(
  `[gameSnapshotWorker] Starting worker`
);

console.log(
  `[gameSnapshotWorker] AWS region: ${awsRegion}`
);

console.log(
  `[gameSnapshotWorker] State machine: ${stateMachineArn}`
);

console.log(
  `[gameSnapshotWorker] Storage bucket: ${gameStorageBucket}`
);

console.log(
  `[gameSnapshotWorker] Queue: game-snapshot`
);

const sfn = new SFNClient({
  region: awsRegion,
});

const worker = new Worker(
  "game-snapshot",

  async (job) => {

    console.log(
      `\n[gameSnapshotWorker] ================================`
    );

    console.log(
      `[gameSnapshotWorker] Target regions:`,
      job.data.targetRegions
    );

    const executionName =
    `game-${gamePostId}-${Date.now()}`


    console.log(
      `[gameSnapshotWorker] Execution name: ${executionName}`
    );

    // ==========================================================
    // Validate S3 key
    // ==========================================================

    const s3Key = String(
      job.data.s3Key || ""
    ).replace(/^\/+/, "");

    if (!s3Key) {
      throw new Error(
        "[gameSnapshotWorker] s3Key is missing"
      );
    }

    // ==========================================================
    // Build canonical S3 URI
    // ==========================================================

    const s3Url =
      `s3://${gameStorageBucket}/${s3Key}`;

    console.log(
      `[gameSnapshotWorker] S3 key: ${s3Key}`
    );

    console.log(
      `[gameSnapshotWorker] S3 URL: ${s3Url}`
    );

    console.log(
      `[gameSnapshotWorker] Starting Step Functions execution...`
    );

    const input = {
      gamePostId: job.data.gamePostId,
      gameId: job.data.gameId,
      buildId: job.data.buildId,
      startPath: job.data.startPath,

      // Keep the key separately.
      s3Key,

      // IMPORTANT:
      // Do NOT pass job.data.s3Url because it may be
      // an application path such as /games/builds/...
      s3Url,

      format: job.data.format,
      buildSize: job.data.buildSize,
      sourceRegion: job.data.sourceRegion,
      targetRegions: job.data.targetRegions,
    };

    console.log(
      "[gameSnapshotWorker] Step Functions input:",
      JSON.stringify(input, null, 2)
    );

    try {

      const command =
        new StartExecutionCommand({
          stateMachineArn,
          name: executionName,
          input: JSON.stringify(input),
        });

      const response =
        await sfn.send(command);

      if (!response.executionArn) {
        throw new Error(
          "Step Functions execution was not started"
        );
      }

      console.log(
        `[gameSnapshotWorker] Step Functions execution started`
      );

      console.log(
        `[gameSnapshotWorker] Execution ARN: ${response.executionArn}`
      );

      console.log(
        `[gameSnapshotWorker] Job ${job.id} finished successfully`
      );

      console.log(
        `[gameSnapshotWorker] ================================\n`
      );

      return {
        success: true,
        gamePostId: job.data.gamePostId,
        executionArn: response.executionArn,
        executionName,
      };

    } catch (error) {

      console.error(
        `[gameSnapshotWorker] Failed to start Step Functions for job ${job.id}`
      );

      console.error(
        "[gameSnapshotWorker] Error:",
        error
      );

      throw error;
    }
  },

  {
    connection: redisConfig,
    concurrency: 3,
    stalledInterval: 30000,
  }
);

worker.on("ready", () => {
  console.log(
    "[gameSnapshotWorker] Worker connected and ready"
  );
});

worker.on("completed", (job) => {
  console.log(
    `[gameSnapshotWorker] Job ${job.id} completed`
  );
});

worker.on("failed", (job, err) => {
  console.error(
    `[gameSnapshotWorker] Job ${job?.id} failed`
  );

  console.error(
    "[gameSnapshotWorker] Error:",
    err
  );
});

worker.on("error", (err) => {
  console.error(
    "[gameSnapshotWorker] Worker error:",
    err
  );
});