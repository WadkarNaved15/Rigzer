// models/Chat.js
import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
  },
  { timestamps: true }
);

// Ensure a chat between two users is not duplicated
chatSchema.index({ participants: 1 }, { unique: false });

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;
