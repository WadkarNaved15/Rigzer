// redis.js
import dotenv from "dotenv";
import { createClient } from "redis";

// Load environment variables
dotenv.config();

const client = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    tls: false, // Redis Cloud uses secure TLS connections
  },
});

// Handle errors gracefully
client.on("error", (err) => console.error("❌ Redis Client Error:", err));

/**
 * Connects to Redis and optionally performs a test command.
 */
const connectRedis = async () => {
  try {
    await client.connect();
    console.log("✅ Connected to Redis Cloud");

    // Optional test
    await client.set("foo", "bar");
    const result = await client.get("foo");
    console.log("Test Key:", result); // should print: bar
  } catch (error) {
    console.error("❌ Redis Connection Failed:", error);
  }
};

await connectRedis();

// Export for use in other modules
export default client;
