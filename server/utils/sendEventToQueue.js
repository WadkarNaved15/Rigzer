import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "../config/sqsClient.js";

export const sendEventToQueue = async (event) => {
  try {
    const command = new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(event),
    });

    await sqsClient.send(command);

    console.log("✅ Event pushed to SQS:", event.type);
  } catch (error) {
    console.error("❌ SQS Push Failed:", error.message);
  }
};
