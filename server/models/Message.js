
import mongoose from "mongoose";

const encryptedPayloadSchema = new mongoose.Schema(
  {
    // Base64-encoded Signal Protocol ciphertext
    ciphertext: {
      type: String,
      required: true,
    },

    // Signal Protocol message type
    signalType: {
      type: String,
      enum: ["SignalMessage", "PreKeySignalMessage"],
      required: true,
    },

    // Sender's device ID
    deviceId: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const encryptionSchema = new mongoose.Schema(
  {
    protocol: {
      type: String,
      enum: ["signal"],
      required: true,
    },

    // Your application's envelope version
    version: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  { _id: false }
);

const replyToSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    e2eeMessageId: {
      type: String,
      default: null,
    },

    // E2EE fields
    encryptedPayload: {
      type: encryptedPayloadSchema,
      default: null,
    },

    encryption: {
      type: encryptionSchema,
      default: null,
    },

    // Logical message type
    messageType: {
      type: String,
      enum: ["text", "media", "post"],
      default: "text",
    },

    // Media URL points to encrypted file in Cloudinary
    mediaUrl: {
      type: String,
      default: null,
    },

    // Image/video classification. This is visible metadata.
    mediaType: {
      type: String,
      enum: ["image", "video", null],
      default: null,
    },

    // Reply reference only. Do not store plaintext previews.
    replyTo: {
      type: replyToSchema,
      default: null,
    },

    // Keep these for legacy messages only.
    // Do not populate them for new E2EE messages.
    text: {
      type: String,
      default: "",
    },

    mediaKey: {
      type: String,
      default: null,
    },

    sharedPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    seen: {
      type: Boolean,
      default: false,
    },

    seenAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Validate encrypted messages.
messageSchema.pre("validate", function () {
  if (this.encryption?.protocol === "signal") {
    if (!this.encryptedPayload?.ciphertext) {
      throw new Error("Encrypted message ciphertext is required");
    }

    if (!this.encryptedPayload?.signalType) {
      throw new Error("Signal message type is required");
    }

    if (!this.encryptedPayload?.deviceId) {
      throw new Error("Sender device ID is required");
    }

    if (this.encryption.version !== 1) {
      throw new Error("Unsupported encryption version");
    }

    // Prevent accidentally saving plaintext alongside ciphertext.
    if (this.text) {
      throw new Error("Plaintext is not allowed in encrypted messages");
    }

    if (this.mediaKey) {
      throw new Error("Media encryption keys must not be stored here");
    }

    if (this.sharedPostId) {
      throw new Error("Post references must be inside encrypted payload");
    }

    if (this.replyTo && "text" in this.replyTo) {
      throw new Error("Plaintext reply previews are not allowed");
    }
  }
});

messageSchema.index({
  chatId: 1,
  createdAt: -1,
  _id: -1,
});

messageSchema.index({
  receiverId: 1,
  seen: 1,
});

messageSchema.index({
  receiverId: 1,
  chatId: 1,
  seen: 1,
});

messageSchema.index({
  senderId: 1,
  receiverId: 1,
});

messageSchema.index(
  { e2eeMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      e2eeMessageId: { $type: "string" },
    },
  }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
