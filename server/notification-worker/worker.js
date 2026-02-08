import "../loadEnv.js";
import mongoose from "mongoose";
import { startSQSConsumer } from "./sqsConsumer.js";

const startWorker = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Worker DB Connected");

    // ✅ Start consuming only after DB is ready
    startSQSConsumer();
  } catch (err) {
    console.log("❌ Worker Startup Error:", err);
  }
};

startWorker();
