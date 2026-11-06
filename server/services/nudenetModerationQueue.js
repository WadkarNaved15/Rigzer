import { randomUUID } from "crypto";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "../config/sqsClient.js";

export const enqueueNudenetModerationJob = async ({
  postId,
  assetKey,
}) => {
  if (!postId || !assetKey) {
    throw new Error(
      "Cannot enqueue NudeNet moderation job: postId and assetKey are required"
    );
  }

  const queueUrl = process.env.NUDENET_MODERATION_QUEUE_URL;
  const bucket = process.env.AWS_BUCKET_NAME;

  if (!queueUrl || !bucket) {
    throw new Error(
      "Cannot enqueue NudeNet moderation job: NUDENET_MODERATION_QUEUE_URL or AWS_BUCKET_NAME is missing"
    );
  }

  const job = {
    job_id: randomUUID(),
    post_id: postId.toString(),
    post_type: "normal_post",
    asset_type: "image",
    asset_key: assetKey,
    s3_bucket: bucket,
    s3_key: assetKey,
  };

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(job),
    })
  );

  console.log(
    `NudeNet moderation job queued: ${job.job_id}, post: ${job.post_id}`
  );

  return job;
};