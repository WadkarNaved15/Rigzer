import redis from "../config/redis.js";
import { sessionStreams } from "./sessionStream.js";
import { createClient } from "redis";

// ----------------------------------
// Publisher (shared with app Redis)
// ----------------------------------
export const pub = redis;

// ----------------------------------
// Subscriber (DEDICATED CONNECTION)
// ----------------------------------
let sub;
let initialized = false;

export const initializeSessionPubSub = async () => {
  if (initialized) return;
  initialized = true;

  sub = createClient({
    socket: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    },
    password: process.env.REDIS_PASSWORD,
  });

  sub.on("error", (err) => {
    console.error("❌ Redis SUB error:", err);
  });

  await sub.connect();

  await sub.pSubscribe("session:*", (message, channel) => {
    try {
      const sessionId = channel.split(":")[1];
      const payload = JSON.parse(message);

      const send = sessionStreams.get(sessionId);
      if (send) {
        send(payload); // 🔥 SSE push
      }
    } catch (err) {
      console.error("Session pubsub parse error:", err);
    }
  });

  console.log("✅ Session PubSub initialized");
};

// ----------------------------------
// Publish helper
// ----------------------------------
export const publishSessionEvent = async (sessionId, payload) => {
  try {
    await pub.publish(
      `session:${sessionId}`,
      JSON.stringify(payload)
    );
  } catch (err) {
    console.error("❌ Redis publish failed:", err);
  }
};
