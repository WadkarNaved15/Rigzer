import mongoose from "mongoose";

const e2eeDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // SDK device IDs are numeric (1–5).
    deviceId: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    registrationId: {
        type: Number,
        default: null,
    },

    identity: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },

    identityType: {
      type: String,
      default: "aci",
      required: true,
    },

    // Stable browser-installation identifier from deviceMiddleware.
    // This is NOT the SDK's numeric deviceId.
    browserDeviceId: {
        type: String,
        required: true,
    },

    encryptedDeviceName: {
      type: String,
      default: null,
    },

    deviceType: {
      type: String,
      default: "web",
    },

    registered: {
      type: Boolean,
      default: false,
    },

    linked: {
      type: Boolean,
      default: false,
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    lastSeenAt: {
      type: Date,
      default: null,
    },

    linkedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

e2eeDeviceSchema.index(
  { userId: 1, deviceId: 1 },
  { unique: true }
);

e2eeDeviceSchema.index(
  { userId: 1, browserDeviceId: 1 },
  { unique: true }
);

const E2EEDevice = mongoose.model("E2EEDevice", e2eeDeviceSchema);

export default E2EEDevice;