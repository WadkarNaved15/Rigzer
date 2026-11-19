
import mongoose from "mongoose";

const chatRequestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Legacy field for existing requests only.
    firstMessage: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    // New encrypted first message.
    encryptedFirstMessage: {
      ciphertext: {
        type: String,
        default: null,
      },

      signalType: {
        type: String,
        enum: [
          "SignalMessage",
          "PreKeySignalMessage",
          null,
        ],
        default: null,
      },

      deviceId: {
        type: String,
        default: null,
      },

      protocol: {
        type: String,
        enum: ["signal", null],
        default: null,
      },

      version: {
        type: Number,
        default: null,
      },
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },

    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

chatRequestSchema.index(
  {
    sender: 1,
    receiver: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "pending",
    },
  }
);

export default mongoose.model("ChatRequest", chatRequestSchema);
