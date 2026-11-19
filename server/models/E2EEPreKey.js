
import mongoose from "mongoose";

const e2eePreKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    deviceId: {
      type: Number,
      required: true,
    },

    identityType: {
      type: String,
      enum: ["aci", "pni"],
      default: "aci",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "ecPreKey",
        "ecSignedPreKey",
        "kemOneTimePreKey",
        "kemLastResortPreKey",
      ],
      required: true,
    },

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
      default: null,
    },

    // Null means no configured expiration.
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

e2eePreKeySchema.index(
  {
    userId: 1,
    deviceId: 1,
    identityType: 1,
    type: 1,
    keyId: 1,
  },
  { unique: true }
);

e2eePreKeySchema.index({
  userId: 1,
  deviceId: 1,
  identityType: 1,
  type: 1,
  expiresAt: 1,
});

const E2EEPreKey = mongoose.model("E2EEPreKey", e2eePreKeySchema);

export default E2EEPreKey;
