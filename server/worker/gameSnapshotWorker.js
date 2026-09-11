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

if (!stateMachineArn) {
  throw new Error(
    "[gameSnapshotWorker] GAME_SNAPSHOT_STATE_MACHINE_ARN is not configured"
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
      `[gameSnapshotWorker] Processing job ${job.id}`
    );

    console.log(
      `[gameSnapshotWorker] GamePost: ${job.data.gamePostId}`
    );

    console.log(
      `[gameSnapshotWorker] Build: ${job.data.buildId}`
    );

    console.log(
      `[gameSnapshotWorker] Game: ${job.data.gameId}`
    );

    console.log(
      `[gameSnapshotWorker] Format: ${job.data.format}`
    );

    console.log(
      `[gameSnapshotWorker] S3 key: ${job.data.s3Key}`
    );

    console.log(
      `[gameSnapshotWorker] Source region: ${job.data.sourceRegion}`
    );

    console.log(
      `[gameSnapshotWorker] Target regions:`,
      job.data.targetRegions
    );

    const executionName =
      `game-${job.data.gamePostId}-${job.data.buildId}`
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .slice(0, 80);

    console.log(
      `[gameSnapshotWorker] Execution name: ${executionName}`
    );

    console.log(
      `[gameSnapshotWorker] Starting Step Functions execution...`
    );

    const input = {
      gamePostId: job.data.gamePostId,
      gameId: job.data.gameId,
      buildId: job.data.buildId,
      startPath: job.data.startPath,
      s3Key: job.data.s3Key,
      s3Url: job.data.s3Url,
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

      const command = new StartExecutionCommand({
        stateMachineArn,
        name: executionName,
        input: JSON.stringify(input),
      });

      const response = await sfn.send(command);

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