import { randomUUID } from "crypto";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "../config/sqsClient.js";

export const enqueueSemanticTaggingJob = async ({
    postId,
    bucket,
    key,
    mediaType,
    operation,
    contentVersion,
}) => {

    if (!postId || !bucket || !key) {
        console.error("❌ Cannot enqueue semantic tagging job: Missing required fields", {
            postId,
            bucket,
            key,
        });
        return null;
    }
    const jobId = randomUUID();

    const message = {
        jobId,
        postId,
        bucket,
        key,
        mediaType,
        operation,
        contentVersion,
    };

    const command = new SendMessageCommand({
        QueueUrl: process.env.SEMANTIC_TAGGING_QUEUE_URL,
        MessageBody: JSON.stringify(message),
    });

    await sqsClient.send(command);

    console.log(
        `✅ Semantic tagging job queued: ${jobId}`
    );

    return message;
};