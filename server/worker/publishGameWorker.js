import { Worker } from "bullmq";
import { redisConfig } from "../config/redis.js";

import {
  runPublishJob,
} from "../routes/gamePosts.js";

console.log(
  "[publishGameWorker] Starting worker for queue: publish-game"
);

const worker = new Worker(
  "publish-game",
  async (job) => {

    console.log(
      `[publishGameWorker] Processing job ${job.id}`
    );

    console.log(
      `[publishGameWorker] Job data:`,
      JSON.stringify(job.data)
    );

    try {
      const result = await runPublishJob(
        job.data.draftId,
        job.data.creditPurchaseId
      );

      console.log(
        `[publishGameWorker] Publish job ${job.id} completed`
      );

      return {
        success: true,
        draftId: job.data.draftId,
        result,
      };

    } catch (error) {

      console.error(
        `[publishGameWorker] Publish job ${job.id} failed:`,
        error
      );

      throw error;
    }
  },
  {
    connection: redisConfig,
    concurrency: 5,
    stalledInterval: 30000,
  }
);

worker.on("ready", () => {
  console.log(
    "[publishGameWorker] Worker connected and ready"
  );
});

worker.on("completed", (job) => {
  console.log(
    `[publishGameWorker] Job ${job.id} completed`
  );
});

worker.on("failed", (job, err) => {
  console.error(
    `[publishGameWorker] Job ${job?.id} failed`
  );

  console.error(err);
});

worker.on("error", (err) => {
  console.error(
    "[publishGameWorker] Worker error:",
    err
  );
});