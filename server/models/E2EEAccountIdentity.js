import mongoose from "mongoose";

const CompositeIdentitySchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
      enum: [1],
    },
    x25519PublicKey: {
      type: String,
      required: true,
    },
    ed25519PublicKey: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const E2EEAccountIdentitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    identityType: {
      type: String,
      enum: ["aci", "pni"],
      default: "aci",
      required: true,
    },

    identity: {
      type: CompositeIdentitySchema,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One canonical identity per user per identity namespace.
E2EEAccountIdentitySchema.index(
  {
    userId: 1,
    identityType: 1,
  },
  {
    unique: true,
  }
);

const E2EEAccountIdentity = mongoose.model(
  "E2EEAccountIdentity",
  E2EEAccountIdentitySchema
);

export default E2EEAccountIdentity;