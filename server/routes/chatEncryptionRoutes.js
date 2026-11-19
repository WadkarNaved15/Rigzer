
import express from "express";
import mongoose from "mongoose";

import ChatDevice from "../models/ChatDevice.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

// Register a device's public keys
router.post("/devices", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      deviceId,
      registrationId,
      identityKey,
      signedPreKey,
      oneTimePreKeys,
    } = req.body;

    if (
      typeof deviceId !== "string" ||
      !deviceId.trim() ||
      !Number.isInteger(registrationId) ||
      registrationId <= 0 ||
      typeof identityKey !== "string" ||
      !identityKey ||
      !signedPreKey ||
      !Number.isInteger(signedPreKey.keyId) ||
      typeof signedPreKey.publicKey !== "string" ||
      typeof signedPreKey.signature !== "string" ||
      !Array.isArray(oneTimePreKeys)
    ) {
      return res.status(400).json({
        message: "Invalid encryption key bundle",
      });
    }

    if (
      oneTimePreKeys.length > 100 ||
      oneTimePreKeys.some(
        (key) =>
          !Number.isInteger(key.keyId) ||
          typeof key.publicKey !== "string" ||
          !key.publicKey
      )
    ) {
      return res.status(400).json({
        message: "Invalid one-time prekeys",
      });
    }

    const existingDevice = await ChatDevice.findOne({
      userId,
      deviceId,
    });

    if (
      existingDevice &&
      existingDevice.identityKey !== identityKey
    ) {
      return res.status(409).json({
        message: "Identity key changed. Device verification required.",
        code: "IDENTITY_KEY_CHANGED",
      });
    }

    const device = await ChatDevice.findOneAndUpdate(
      { userId, deviceId },
      {
        $set: {
          registrationId,
          identityKey,
          signedPreKey,
          oneTimePreKeys,
          isActive: true,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    res.json({
      success: true,
      deviceId: device.deviceId,
    });
  } catch (err) {
    console.error("Register encryption device:", err);

    res.status(500).json({
      message: "Unable to register device",
    });
  }
});

// Fetch and consume recipient's public prekeys
router.get("/prekeys/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    if (userId === String(req.user.id)) {
      return res.status(400).json({
        message: "Cannot fetch your own prekeys through this endpoint",
      });
    }

    const devices = await ChatDevice.find({
      userId,
      isActive: true,
    }).lean();

    const bundles = [];

    for (const device of devices) {
      // Atomically consume one one-time prekey.
      const updated = await ChatDevice.findOneAndUpdate(
        {
          _id: device._id,
          "oneTimePreKeys.0": { $exists: true },
        },
        {
          $pop: { oneTimePreKeys: -1 },
        },
        {
          new: false,
        }
      );

      bundles.push({
        deviceId: device.deviceId,
        registrationId: device.registrationId,
        identityKey: device.identityKey,
        signedPreKey: device.signedPreKey,
        oneTimePreKey:
          updated?.oneTimePreKeys?.[0] || null,
      });
    }

    res.json({ bundles });
  } catch (err) {
    console.error("Fetch encryption prekeys:", err);

    res.status(500).json({
      message: "Unable to fetch encryption keys",
    });
  }
});

export default router;
