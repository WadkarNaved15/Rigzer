
import mongoose from "mongoose";

const OneTimePreKeySchema = new mongoose.Schema(
  {
    keyId: {
      type: Number,
      required: true,
    },

    publicKey: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const ChatDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    deviceId: {
      type: String,
      required: true,
      trim: true,
    },

    registrationId: {
      type: Number,
      required: true,
    },

    identityKey: {
      type: String,
      required: true,
    },

    signedPreKey: {
      keyId: {
        type: Number,
        required: true,
      },

      publicKey: {
        type: String,
        required: true,
      },

      signature: {
        type: String,
        required: true,
      },
    },

    oneTimePreKeys: {
      type: [OneTimePreKeySchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

ChatDeviceSchema.index(
  { userId: 1, deviceId: 1 },
  { unique: true }
);

export default mongoose.model("ChatDevice", ChatDeviceSchema);
