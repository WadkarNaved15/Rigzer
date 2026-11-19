import mongoose from "mongoose";

const e2eeEnvelopeSchema = new mongoose.Schema(
  {
    envelopeId: {
      type: String,
      required: true,
      unique: true,
    },

    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    senderDeviceId: {
      type: Number,
      required: true,
    },

    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    targetDeviceId: {
      type: Number,
      required: true,
    },

    // Base64 representation of the SDK ciphertext.
    ciphertext: {
      type: String,
      required: true,
    },

    messageType: {
      type: String,
      enum: [
        "ciphertext",
        "prekey_bundle",
        "sender_key",
        "unidentified_sender",
        "retry_request",
      ],
      required: true,
    },

    deliveryClass: {
      type: String,
      enum: [
        "user-visible",
        "background-sync",
        "ephemeral",
      ],
      required: true,
    },

    contentKind: {
      type: String,
      enum: ["message", "receipt"],
      default: null,
    },

    clientMessageId: {
      type: String,
      default: null,
    },

    timestamp: {
      type: Number,
      required: true,
    },

    serverTimestamp: {
      type: Number,
      required: true,
    },

    operationEpochMilliseconds: {
      type: Number,
      default: null,
    },

    declaredDeviceIds: {
      type: [Number],
      default: [],
    },

    recipientRegistrationId: {
      type: Number,
      default: null,
    },

    contentHint: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Retrieve pending envelopes for a specific device.
e2eeEnvelopeSchema.index({
  targetUserId: 1,
  targetDeviceId: 1,
  deliveredAt: 1,
  createdAt: 1,
});

// Prevent duplicate delivery when a client retries a send.
e2eeEnvelopeSchema.index(
  {
    senderUserId: 1,
    senderDeviceId: 1,
    targetUserId: 1,
    targetDeviceId: 1,
    clientMessageId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      clientMessageId: { $type: "string" },
    },
  }
);

const E2EEEnvelope = mongoose.model(
  "E2EEEnvelope",
  e2eeEnvelopeSchema
);

export default E2EEEnvelope;