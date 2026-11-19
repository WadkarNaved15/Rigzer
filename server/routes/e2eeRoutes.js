import express from "express";
import E2EEDevice from "../models/E2EEDevice.js";
import E2EEAccountIdentity from "../models/E2EEAccountIdentity.js";
import E2EEEnvelope from "../models/E2EEEnvelope.js";
import E2EEPreKey from "../models/E2EEPreKey.js";
import deviceMiddleware from "../middlewares/deviceMiddleware.js";
import verifyToken from "../middlewares/authMiddleware.js";
import mongoose from "mongoose";
import crypto from "crypto";

const router = express.Router();

// Order matters: deviceMiddleware must run before verifyToken.
router.use(deviceMiddleware, verifyToken);

const ALLOWED_DEVICE_TYPES = [
  "web",
  "desktop",
  "mobile",
  "tablet",
];

const isValidPublicKey = (value) => {
  if (typeof value !== "string") return false;

  const decoded = Buffer.from(value, "base64");

  return (
    decoded.length === 32 &&
    decoded.toString("base64") === value
  );
};

const decodeBase64 = (value, expectedLength) => {
  if (typeof value !== "string") return null;

  const decoded = Buffer.from(value, "base64");

  if (
    decoded.length !== expectedLength ||
    decoded.toString("base64") !== value
  ) {
    return null;
  }

  return decoded;
};

const isSameIdentity = (a, b) => {
  return (
    a.version === b.version &&
    a.x25519PublicKey === b.x25519PublicKey &&
    a.ed25519PublicKey === b.ed25519PublicKey
  );
};

const ENVELOPE_MESSAGE_TYPES = [
  "ciphertext",
  "prekey_bundle",
  "sender_key",
  "unidentified_sender",
  "retry_request",
];

const ENVELOPE_DELIVERY_CLASSES = [
  "user-visible",
  "background-sync",
  "ephemeral",
];

const MAX_ENVELOPE_BYTES = 256 * 1024;
const MAX_MAILBOX_BATCH = 100;

function notifyE2EEDevice(req, userId, deviceId, envelopeId) {
  const io = req.app.get("io");

  if (!io) {
    console.error("[E2EE] Socket.IO is unavailable");
    return;
  }

  io.to(`e2ee-${userId}-${deviceId}`).emit(
    "e2ee:envelope-available",
    {
      envelopeId,
      targetDeviceId: deviceId,
    }
  );
}

const isValidEnvelopeBase64 = (value) => {
  if (typeof value !== "string" || !value.length) {
    return false;
  }

  const decoded = Buffer.from(value, "base64");

  return (
    decoded.length > 0 &&
    decoded.length <= MAX_ENVELOPE_BYTES &&
    decoded.toString("base64") === value
  );
};

const isValidDeviceNumber = (value) =>
  Number.isInteger(value) && value >= 1 && value <= 5;

// Register the current browser as the user's primary E2EE device.
router.post("/devices/register", async (req, res) => {
  try {
    const userId = req.user._id;
    const browserDeviceId = req.deviceId;

    const {
      deviceType = "web",
      encryptedDeviceNameBase64 = null,
    } = req.body;

    if (!ALLOWED_DEVICE_TYPES.includes(deviceType)) {
      return res.status(400).json({
        error: "Invalid device type",
      });
    }

    if (
      encryptedDeviceNameBase64 !== null &&
      (
        typeof encryptedDeviceNameBase64 !== "string" ||
        encryptedDeviceNameBase64.length > 1000
      )
    ) {
      return res.status(400).json({
        error: "Invalid encrypted device name",
      });
    }

    // Repeated registration from the same browser returns
    // the existing numeric SDK device ID.
    const existingBrowser = await E2EEDevice.findOne({
      userId,
      browserDeviceId,
    });

    if (existingBrowser) {
      if (!existingBrowser.enabled) {
        return res.status(403).json({
          error: "This E2EE device has been disabled",
        });
      }

      existingBrowser.deviceType = deviceType;

      if (encryptedDeviceNameBase64 !== null) {
        existingBrowser.encryptedDeviceName =
          encryptedDeviceNameBase64;
      }

      existingBrowser.lastSeenAt = new Date();

      await existingBrowser.save();

      return res.json({
        deviceId: existingBrowser.deviceId,
        registered: existingBrowser.registered,
        existing: true,
      });
    }

    // Initial rollout: only one browser per account.
    const existingAccountDevice = await E2EEDevice.findOne({
      userId,
      enabled: true,
    });

    if (existingAccountDevice) {
      return res.status(409).json({
        error: "An E2EE device is already registered. Device linking is not enabled yet.",
      });
    }

    const device = await E2EEDevice.create({
        userId,
        browserDeviceId,
        deviceId: 1,
        deviceType,
        encryptedDeviceName: encryptedDeviceNameBase64,
        registered: false,
        linked: false,
        enabled: true,
        lastSeenAt: new Date(),
    });

    return res.status(201).json({
      deviceId: device.deviceId,
      registered: device.registered,
      existing: false,
    });
  } catch (error) {
    // Handle simultaneous registration attempts safely.
    if (error.code === 11000) {
      try {
        const existing = await E2EEDevice.findOne({
          userId: req.user._id,
          browserDeviceId: req.deviceId,
        });

        if (existing) {
          return res.json({
            deviceId: existing.deviceId,
            registered: existing.registered,
            existing: true,
          });
        }
      } catch (lookupError) {
        console.error("[E2EE] Registration lookup failed:", lookupError);
      }
    }

    console.error("[E2EE] Device registration failed:", error);

    return res.status(500).json({
      error: "Device registration failed",
    });
  }
});

// List devices belonging to the authenticated account.
router.get("/devices", async (req, res) => {
  try {
    const devices = await E2EEDevice.find({
      userId: req.user._id,
    })
      .select(
        "deviceId deviceType registered linked enabled lastSeenAt createdAt linkedAt"
      )
      .sort({ deviceId: 1 })
      .lean();

    return res.json({ devices });
  } catch (error) {
    console.error("[E2EE] Device listing failed:", error);

    return res.status(500).json({
      error: "Unable to retrieve E2EE devices",
    });
  }
});


router.post("/identity/provision", async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      deviceId,
      registrationId,
      identity,
      identityType = "aci",
    } = req.body;

    // Validate device ID
    if (
      !Number.isInteger(deviceId) ||
      deviceId < 1 ||
      deviceId > 5
    ) {
      return res.status(400).json({
        message: "Invalid device ID",
      });
    }

    // Validate registration ID
    if (
        !Number.isInteger(registrationId) ||
        registrationId < 1 ||
        registrationId > 16383
    ) {
        return res.status(400).json({ message: "Invalid registration ID" });
    }

    // Validate identity namespace
    if (!["aci", "pni"].includes(identityType)) {
      return res.status(400).json({
        message: "Invalid identity type",
      });
    }

    // Validate composite identity
    if (
      !identity ||
      identity.version !== 1 ||
      !isValidPublicKey(identity.x25519PublicKey) ||
      !isValidPublicKey(identity.ed25519PublicKey)
    ) {
      return res.status(400).json({
        message: "Invalid composite identity",
      });
    }

    // Verify this browser owns the requested E2EE device.
    const device = await E2EEDevice.findOne({
      userId,
      deviceId,
      browserDeviceId: req.deviceId,
      enabled: true,
    });

    if (!device) {
      return res.status(403).json({
        message: "E2EE device not found or disabled",
      });
    }

    // Do not silently reset an already provisioned device.
    if (
      device.registered &&
      device.registrationId !== registrationId
    ) {
      return res.status(409).json({
        message: "Device registration changed. Explicit reset is required.",
      });
    }

    // Create the account identity if absent.
    // $setOnInsert ensures an existing identity is never overwritten.
    let accountIdentity;

    try {
      accountIdentity = await E2EEAccountIdentity.findOneAndUpdate(
        {
          userId,
          identityType,
        },
        {
          $setOnInsert: {
            userId,
            identityType,
            identity,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
    } catch (error) {
      // Another request may have created the unique identity concurrently.
      if (error.code !== 11000) {
        throw error;
      }

      accountIdentity = await E2EEAccountIdentity.findOne({
        userId,
        identityType,
      });
    }

    if (!accountIdentity) {
      return res.status(500).json({
        message: "Could not provision account identity",
      });
    }

    // Every device must use the same canonical account identity.
    if (!isSameIdentity(accountIdentity.identity, identity)) {
      return res.status(409).json({
        message: "Identity mismatch. Existing account identity cannot be replaced.",
      });
    }

    // Mark device as provisioned.
    device.registrationId = registrationId;
    device.registered = true;
    device.lastSeenAt = new Date();

    await device.save();

    return res.status(200).json({
      success: true,
      message: "E2EE identity provisioned successfully",
      deviceId: device.deviceId,
      identityType,
    });
  } catch (error) {
    console.error("[E2EE] Identity provisioning error:", error);

    return res.status(500).json({
      message: "Identity provisioning failed",
    });
  }
});


// Get another user's active E2EE devices.
// Required for recipient device discovery.
router.get("/users/:targetUserId/devices", async (req, res) => {
  try {
    const { targetUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }

    const devices = await E2EEDevice.find({
      userId: targetUserId,
      enabled: true,
      registered: true,
    })
      .select(
        "deviceId deviceType encryptedDeviceName registered linked enabled lastSeenAt createdAt linkedAt"
      )
      .sort({ deviceId: 1 })
      .lean();

    return res.json({ devices });
  } catch (error) {
    console.error("[E2EE] Recipient device lookup failed:", error);

    return res.status(500).json({
      error: "Unable to retrieve recipient devices",
    });
  }
});


// Retrieve another user's public account identity.
router.get("/users/:targetUserId/identity", async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const identityType = req.query.identityType || "aci";

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }

    if (!["aci", "pni"].includes(identityType)) {
      return res.status(400).json({
        error: "Invalid identity type",
      });
    }

    // Only return an identity for an account with an active,
    // registered E2EE device.
    const activeDevice = await E2EEDevice.exists({
      userId: targetUserId,
      enabled: true,
      registered: true,
    });

    if (!activeDevice) {
      return res.status(404).json({
        error: "User has no active E2EE device",
      });
    }

    const accountIdentity = await E2EEAccountIdentity.findOne({
      userId: targetUserId,
      identityType,
    })
      .select("identityType identity")
      .lean();

    if (!accountIdentity) {
      return res.status(404).json({
        error: "E2EE identity not found",
      });
    }

    return res.json({
      identityType: accountIdentity.identityType,
      identity: accountIdentity.identity,
    });
  } catch (error) {
    console.error("[E2EE] Identity lookup failed:", error);

    return res.status(500).json({
      error: "Unable to retrieve E2EE identity",
    });
  }
});


const PREKEY_TYPES = [
  "ecPreKey",
  "ecSignedPreKey",
  "kemOneTimePreKey",
  "kemLastResortPreKey",
];

const PREKEY_PUBLIC_KEY_LENGTHS = {
  ecPreKey: 32,
  ecSignedPreKey: 32,
  kemOneTimePreKey: 1569,
  kemLastResortPreKey: 1569,
};

// Upload public prekeys generated by the Signal Protocol SDK.
router.post("/prekeys", async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      deviceId,
      identityType = "aci",
      keys,
    } = req.body;

    if (
      !Number.isInteger(deviceId) ||
      deviceId < 1 ||
      deviceId > 5
    ) {
      return res.status(400).json({
        error: "Invalid device ID",
      });
    }

    if (!["aci", "pni"].includes(identityType)) {
      return res.status(400).json({
        error: "Invalid identity type",
      });
    }

    if (
      !Array.isArray(keys) ||
      keys.length === 0 ||
      keys.length > 500
    ) {
      return res.status(400).json({
        error: "Invalid prekey batch",
      });
    }

    // Verify the authenticated browser owns this registered device.
    const device = await E2EEDevice.findOne({
      userId,
      deviceId,
      browserDeviceId: req.deviceId,
      enabled: true,
      registered: true,
    });

    if (!device) {
      return res.status(403).json({
        error: "Registered E2EE device not found",
      });
    }

    const seenKeys = new Set();

    for (const key of keys) {
      if (
        !key ||
        !PREKEY_TYPES.includes(key.type) ||
        !Number.isSafeInteger(key.keyId) ||
        key.keyId < 0
      ) {
        return res.status(400).json({
          error: "Invalid prekey entry",
        });
      }

      const uniqueKey = `${key.type}:${key.keyId}`;

      if (seenKeys.has(uniqueKey)) {
        return res.status(400).json({
          error: "Duplicate prekey in batch",
        });
      }

      seenKeys.add(uniqueKey);

      const expectedLength =
        PREKEY_PUBLIC_KEY_LENGTHS[key.type];

      if (!decodeBase64(key.publicKey, expectedLength)) {
        return res.status(400).json({
          error: `Invalid public key for ${key.type}`,
        });
      }

      // All types except unsigned EC one-time prekeys
      // require an Ed25519 signature.
      if (key.type !== "ecPreKey") {
        if (!decodeBase64(key.signature, 64)) {
          return res.status(400).json({
            error: `Invalid signature for ${key.type}`,
          });
        }
      }
    }

    // Prekeys are immutable: an existing key ID must never
    // silently be replaced with different public material.
    const operations = keys.map((key) => ({
      updateOne: {
        filter: {
          userId,
          deviceId,
          identityType,
          type: key.type,
          keyId: key.keyId,
        },
        update: {
          $setOnInsert: {
            userId,
            deviceId,
            identityType,
            type: key.type,
            keyId: key.keyId,
            publicKey: key.publicKey,
            signature: key.signature || null,
          },
        },
        upsert: true,
      },
    }));

    try {
      await E2EEPreKey.bulkWrite(operations, {
        ordered: false,
      });
    } catch (error) {
      // A concurrent retry may have inserted the same unique key.
      if (error.code !== 11000) {
        throw error;
      }
    }

    // Verify that existing IDs contain exactly the same key material.
    const storedKeys = await E2EEPreKey.find({
      userId,
      deviceId,
      identityType,
      $or: keys.map((key) => ({
        type: key.type,
        keyId: key.keyId,
      })),
    }).lean();

    const storedMap = new Map(
      storedKeys.map((key) => [
        `${key.type}:${key.keyId}`,
        key,
      ])
    );

    for (const key of keys) {
      const stored = storedMap.get(
        `${key.type}:${key.keyId}`
      );

      if (
        !stored ||
        stored.publicKey !== key.publicKey ||
        (stored.signature || null) !== (key.signature || null)
      ) {
        return res.status(409).json({
          error: "Prekey ID already exists with different key material",
        });
      }
    }

    device.lastSeenAt = new Date();
    await device.save();

    return res.status(200).json({
      success: true,
      uploaded: keys.length,
      deviceId,
      identityType,
    });
  } catch (error) {
    console.error("[E2EE] Prekey upload failed:", error);

    return res.status(500).json({
      error: "Unable to upload prekeys",
    });
  }
});



router.get(
  "/users/:targetUserId/devices/:deviceId/prekey-bundle",
  async (req, res) => {
    try {
      const { targetUserId } = req.params;
      const deviceId = Number(req.params.deviceId);
      const identityType = req.query.identityType || "aci";

      if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      if (
        !Number.isInteger(deviceId) ||
        deviceId < 1 ||
        deviceId > 5
      ) {
        return res.status(400).json({
          error: "Invalid device ID",
        });
      }

      if (!["aci", "pni"].includes(identityType)) {
        return res.status(400).json({
          error: "Invalid identity type",
        });
      }

      // Verify the recipient device is active and registered.
      const device = await E2EEDevice.findOne({
        userId: targetUserId,
        deviceId,
        enabled: true,
        registered: true,
      }).lean();

      if (!device) {
        return res.status(404).json({
          error: "Recipient device not found",
        });
      }

      // Retrieve the recipient's canonical account identity.
      const accountIdentity = await E2EEAccountIdentity.findOne({
        userId: targetUserId,
        identityType,
      }).lean();

      if (!accountIdentity) {
        return res.status(404).json({
          error: "Recipient identity not found",
        });
      }

      // Signed EC prekey must be available.
      const signedPreKey = await E2EEPreKey.findOne({
        userId: targetUserId,
        deviceId,
        identityType,
        type: "ecSignedPreKey",
      }).sort({ createdAt: -1 }).lean();

      if (!signedPreKey) {
        return res.status(404).json({
          error: "Signed EC prekey not found",
        });
      }

      // Atomically consume one EC one-time prekey.
      // Two concurrent requests cannot receive the same document.
      const ecOneTimePreKey = await E2EEPreKey.findOneAndDelete({
        userId: targetUserId,
        deviceId,
        identityType,
        type: "ecPreKey",
      }).sort({ createdAt: 1 });

      // Atomically consume one KEM one-time prekey.
      const kemOneTimePreKey = await E2EEPreKey.findOneAndDelete({
        userId: targetUserId,
        deviceId,
        identityType,
        type: "kemOneTimePreKey",
      }).sort({ createdAt: 1 });

      let kemPreKey = kemOneTimePreKey;
      let isLastResort = false;

      // Last-resort KEM key is used only when no one-time KEM key remains.
      if (!kemPreKey) {
        kemPreKey = await E2EEPreKey.findOne({
          userId: targetUserId,
          deviceId,
          identityType,
          type: "kemLastResortPreKey",
        }).lean();

        isLastResort = true;
      }

      if (!kemPreKey) {
        return res.status(404).json({
          error: "No KEM prekey available",
        });
      }

      return res.json({
        userId: targetUserId,
        deviceId,
        registrationId: device.registrationId,
        identityType,
        identity: accountIdentity.identity,

        signedPreKey: {
          keyId: signedPreKey.keyId,
          publicKey: signedPreKey.publicKey,
          signature: signedPreKey.signature,
        },

        ecOneTimePreKey: ecOneTimePreKey
          ? {
              keyId: ecOneTimePreKey.keyId,
              publicKey: ecOneTimePreKey.publicKey,
            }
          : null,

        kemPreKey: {
          keyId: kemPreKey.keyId,
          publicKey: kemPreKey.publicKey,
          signature: kemPreKey.signature,
          isLastResort,
        },
      });
    } catch (error) {
      console.error("[E2EE] Prekey bundle retrieval failed:", error);

      return res.status(500).json({
        error: "Unable to retrieve prekey bundle",
      });
    }
  }
);



// Send an encrypted envelope to a specific recipient device.
router.post("/envelopes", async (req, res) => {
  try {
    const senderUserId = req.user._id;

    const {
      senderDeviceId,
      targetUserId,
      targetDeviceId,
      ciphertext,
      messageType,
      deliveryClass,
      contentKind = null,
      clientMessageId = null,
      timestamp,
      operationEpochMilliseconds = null,
      declaredDeviceIds = [],
      recipientRegistrationId = null,
      contentHint = null,
    } = req.body;

    // Validate sender and recipient device IDs.
    if (
      !isValidDeviceNumber(senderDeviceId) ||
      !isValidDeviceNumber(targetDeviceId)
    ) {
      return res.status(400).json({
        error: "Invalid sender or recipient device ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        error: "Invalid target user ID",
      });
    }

    // Validate ciphertext.
    if (!isValidEnvelopeBase64(ciphertext)) {
      return res.status(400).json({
        error: "Invalid or oversized ciphertext",
      });
    }

    if (!ENVELOPE_MESSAGE_TYPES.includes(messageType)) {
      return res.status(400).json({
        error: "Invalid envelope message type",
      });
    }

    if (!ENVELOPE_DELIVERY_CLASSES.includes(deliveryClass)) {
      return res.status(400).json({
        error: "Invalid delivery class",
      });
    }

    if (
      contentKind !== null &&
      !["message", "receipt"].includes(contentKind)
    ) {
      return res.status(400).json({
        error: "Invalid content kind",
      });
    }

    if (
      !Number.isSafeInteger(timestamp) ||
      timestamp <= 0
    ) {
      return res.status(400).json({
        error: "Invalid envelope timestamp",
      });
    }

    if (
      clientMessageId !== null &&
      (
        typeof clientMessageId !== "string" ||
        clientMessageId.length > 128
      )
    ) {
      return res.status(400).json({
        error: "Invalid client message ID",
      });
    }

    if (
      !Array.isArray(declaredDeviceIds) ||
      declaredDeviceIds.length > 5 ||
      declaredDeviceIds.some((id) => !isValidDeviceNumber(id))
    ) {
      return res.status(400).json({
        error: "Invalid declared device IDs",
      });
    }

    if (
      recipientRegistrationId !== null &&
      (
        !Number.isInteger(recipientRegistrationId) ||
        recipientRegistrationId < 1 ||
        recipientRegistrationId > 16383
      )
    ) {
      return res.status(400).json({
        error: "Invalid recipient registration ID",
      });
    }

    if (
      operationEpochMilliseconds !== null &&
      (
        !Number.isSafeInteger(operationEpochMilliseconds) ||
        operationEpochMilliseconds < 0
      )
    ) {
      return res.status(400).json({
        error: "Invalid operation epoch",
      });
    }

    // Verify that this authenticated browser owns the sender device.
    const senderDevice = await E2EEDevice.findOne({
      userId: senderUserId,
      deviceId: senderDeviceId,
      browserDeviceId: req.deviceId,
      enabled: true,
      registered: true,
    }).lean();

    if (!senderDevice) {
      return res.status(403).json({
        error: "Sender device is not registered or is disabled",
      });
    }

    // Verify the target device is active and registered.
    const targetDevice = await E2EEDevice.findOne({
      userId: targetUserId,
      deviceId: targetDeviceId,
      enabled: true,
      registered: true,
    }).lean();

    if (!targetDevice) {
      return res.status(404).json({
        error: "Recipient device not found",
      });
    }

    // Prevent sending to a stale recipient registration.
    if (
      recipientRegistrationId !== null &&
      targetDevice.registrationId !== recipientRegistrationId
    ) {
      return res.status(409).json({
        error: "Recipient registration has changed",
      });
    }


// Idempotency: retries with the same client message ID
// must return the previously stored envelope.
if (clientMessageId) {
  const existing = await E2EEEnvelope.findOne({
    senderUserId,
    senderDeviceId,
    targetUserId,
    targetDeviceId,
    clientMessageId,
  }).lean();

  if (existing) {
    // Notify only when an existing envelope is found.
    notifyE2EEDevice(
      req,
      targetUserId,
      targetDeviceId,
      existing.envelopeId
    );

    return res.status(200).json({
      messageId: existing.envelopeId,
      serverTimestamp: existing.serverTimestamp,
      duplicate: true,
      expiresAt: existing.expiresAt
        ? existing.expiresAt.getTime()
        : null,
    });
  }
}


    const envelopeId = crypto.randomUUID();
    const serverTimestamp = Date.now();

    const envelope = await E2EEEnvelope.create({
      envelopeId,
      senderUserId,
      senderDeviceId,
      targetUserId,
      targetDeviceId,
      ciphertext,
      messageType,
      deliveryClass,
      contentKind,
      clientMessageId,
      timestamp,
      serverTimestamp,
      operationEpochMilliseconds,
      declaredDeviceIds,
      recipientRegistrationId,
      contentHint,
    });

    notifyE2EEDevice(
        req,
        targetUserId,
        targetDeviceId,
        envelope.envelopeId
        );

    // Update sender device activity.
    await E2EEDevice.updateOne(
      {
        userId: senderUserId,
        deviceId: senderDeviceId,
      },
      {
        $set: { lastSeenAt: new Date() },
      }
    );

    return res.status(201).json({
      messageId: envelope.envelopeId,
      serverTimestamp: envelope.serverTimestamp,
      duplicate: false,
      expiresAt: envelope.expiresAt
        ? envelope.expiresAt.getTime()
        : null,
    });
  } catch (error) {
    // Handle a concurrent retry that inserted the same clientMessageId.
    if (error.code === 11000 && req.body?.clientMessageId) {
      try {
        const existing = await E2EEEnvelope.findOne({
          senderUserId: req.user._id,
          senderDeviceId: req.body.senderDeviceId,
          targetUserId: req.body.targetUserId,
          targetDeviceId: req.body.targetDeviceId,
          clientMessageId: req.body.clientMessageId,
        }).lean();

        if (existing) {
          return res.status(200).json({
            messageId: existing.envelopeId,
            serverTimestamp: existing.serverTimestamp,
            duplicate: true,
            expiresAt: existing.expiresAt
              ? existing.expiresAt.getTime()
              : null,
          });
        }
      } catch (lookupError) {
        console.error(
          "[E2EE] Duplicate envelope lookup failed:",
          lookupError
        );
      }
    }

    console.error("[E2EE] Envelope send failed:", error);

    return res.status(500).json({
      error: "Unable to send encrypted envelope",
    });
  }
});


// Retrieve pending envelopes for the authenticated browser device.
router.get("/mailbox", async (req, res) => {
  try {
    const deviceId = Number(req.query.deviceId);

    if (!isValidDeviceNumber(deviceId)) {
      return res.status(400).json({
        error: "Invalid device ID",
      });
    }

    // The browser UUID prevents another browser from polling
    // this account's E2EE device mailbox.
    const device = await E2EEDevice.findOne({
      userId: req.user._id,
      deviceId,
      browserDeviceId: req.deviceId,
      enabled: true,
      registered: true,
    }).lean();

    if (!device) {
      return res.status(403).json({
        error: "E2EE device not found or disabled",
      });
    }

    const envelopes = await E2EEEnvelope.find({
      targetUserId: req.user._id,
      targetDeviceId: deviceId,
      deliveredAt: null,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(MAX_MAILBOX_BATCH)
      .lean();

    const results = envelopes.map((envelope) => ({
      // Include both IDs so the relay adapter can map the
      // server message ID back to the SDK envelope.
      id: envelope.envelopeId,
      envelopeId: envelope.envelopeId,

      targetUserId: envelope.targetUserId.toString(),
      targetDeviceId: envelope.targetDeviceId,

      senderUserId: envelope.senderUserId.toString(),
      senderDeviceId: envelope.senderDeviceId,

      ciphertext: envelope.ciphertext,
      messageType: envelope.messageType,
      deliveryClass: envelope.deliveryClass,
      contentKind: envelope.contentKind,

      clientMessageId: envelope.clientMessageId,
      timestamp: envelope.timestamp,
      serverTimestamp: envelope.serverTimestamp,

      operationEpochMilliseconds:
        envelope.operationEpochMilliseconds,

      declaredDeviceIds: envelope.declaredDeviceIds,
      recipientRegistrationId: envelope.recipientRegistrationId,
      contentHint: envelope.contentHint,
    }));

    await E2EEDevice.updateOne(
      {
        userId: req.user._id,
        deviceId,
      },
      {
        $set: { lastSeenAt: new Date() },
      }
    );

    return res.json({
      envelopes: results,
      count: results.length,
    });
  } catch (error) {
    console.error("[E2EE] Mailbox retrieval failed:", error);

    return res.status(500).json({
      error: "Unable to retrieve encrypted envelopes",
    });
  }
});


// Acknowledge successful delivery to the recipient device.
router.post("/envelopes/:envelopeId/ack", async (req, res) => {
  try {
    const { envelopeId } = req.params;
    const deviceId = Number(req.body.deviceId);

    if (!envelopeId || envelopeId.length > 128) {
      return res.status(400).json({
        error: "Invalid envelope ID",
      });
    }

    if (!isValidDeviceNumber(deviceId)) {
      return res.status(400).json({
        error: "Invalid device ID",
      });
    }

    // Verify that this browser owns the recipient device.
    const device = await E2EEDevice.findOne({
      userId: req.user._id,
      deviceId,
      browserDeviceId: req.deviceId,
      enabled: true,
      registered: true,
    }).lean();

    if (!device) {
      return res.status(403).json({
        error: "E2EE device not found or disabled",
      });
    }

    const envelope = await E2EEEnvelope.findOneAndUpdate(
      {
        envelopeId,
        targetUserId: req.user._id,
        targetDeviceId: deviceId,
      },
      {
        $set: {
          deliveredAt: new Date(),
        },
      },
      {
        new: true,
      }
    ).lean();

    if (!envelope) {
      return res.status(404).json({
        error: "Envelope not found for this device",
      });
    }

    return res.json({
      success: true,
      envelopeId,
      deliveredAt: envelope.deliveredAt,
    });
  } catch (error) {
    console.error("[E2EE] Envelope acknowledgement failed:", error);

    return res.status(500).json({
      error: "Unable to acknowledge envelope",
    });
  }
});


const VALID_IDENTITY_TYPES = ["aci", "pni"];

const PREKEY_METADATA_TYPES = [
  "ecSignedPreKey",
  "kemLastResortPreKey",
];

async function getOwnedEnabledDevice(userId, browserDeviceId, deviceId) {
  return E2EEDevice.findOne({
    userId,
    browserDeviceId,
    deviceId,
    enabled: true,
  }).lean();
}

async function getOwnedRegisteredDevice(userId, browserDeviceId, deviceId) {
  return E2EEDevice.findOne({
    userId,
    browserDeviceId,
    deviceId,
    enabled: true,
    registered: true,
  }).lean();
}


// Get the number of available EC or KEM one-time prekeys.
router.get("/prekeys/count", async (req, res) => {
  try {
    const deviceId = Number(req.query.deviceId);
    const type = req.query.type;
    const identityType = req.query.identityType || "aci";

    if (
      !Number.isInteger(deviceId) ||
      deviceId < 1 ||
      deviceId > 5
    ) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    if (!["ec", "kem"].includes(type)) {
      return res.status(400).json({ error: "Invalid prekey type" });
    }

    if (!VALID_IDENTITY_TYPES.includes(identityType)) {
      return res.status(400).json({ error: "Invalid identity type" });
    }

    const device = await getOwnedEnabledDevice(
      req.user._id,
      req.deviceId,
      deviceId
    );

    if (!device) {
      return res.status(403).json({ error: "E2EE device not found" });
    }

    const keyTypes =
      type === "ec"
        ? ["ecPreKey"]
        : ["kemOneTimePreKey"];

    const count = await E2EEPreKey.countDocuments({
      userId: req.user._id,
      deviceId,
      identityType,
      type: { $in: keyTypes },
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    });

    return res.json({ count, type, deviceId, identityType });
  } catch (error) {
    console.error("[E2EE] Prekey count failed:", error);

    return res.status(500).json({
      error: "Unable to retrieve prekey count",
    });
  }
});


// Get the inventory of the device's public prekeys.
router.get("/prekeys/inventory", async (req, res) => {
  try {
    const deviceId = Number(req.query.deviceId);
    const identityType = req.query.identityType || "aci";

    if (
      !Number.isInteger(deviceId) ||
      deviceId < 1 ||
      deviceId > 5
    ) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    if (!VALID_IDENTITY_TYPES.includes(identityType)) {
      return res.status(400).json({ error: "Invalid identity type" });
    }

    const device = await getOwnedEnabledDevice(
      req.user._id,
      req.deviceId,
      deviceId
    );

    if (!device) {
      return res.status(403).json({ error: "E2EE device not found" });
    }

    const [ecSignedPreKey, kemLastResortPreKey, ecCount, kemCount] =
      await Promise.all([
        E2EEPreKey.findOne({
          userId: req.user._id,
          deviceId,
          identityType,
          type: "ecSignedPreKey",
        })
          .sort({ createdAt: -1 })
          .lean(),

        E2EEPreKey.findOne({
          userId: req.user._id,
          deviceId,
          identityType,
          type: "kemLastResortPreKey",
        })
          .sort({ createdAt: -1 })
          .lean(),

        E2EEPreKey.countDocuments({
          userId: req.user._id,
          deviceId,
          identityType,
          type: "ecPreKey",
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
          ],
        }),

        E2EEPreKey.countDocuments({
          userId: req.user._id,
          deviceId,
          identityType,
          type: "kemOneTimePreKey",
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
          ],
        }),
      ]);

    const toMetadata = (key) =>
      key
        ? {
            keyId: key.keyId,
            publicKey: key.publicKey,
            createdAt: key.createdAt.getTime(),
            expiresAt: key.expiresAt
              ? key.expiresAt.getTime()
              : null,
          }
        : null;

    return res.json({
      deviceId,
      identityType,
      ecSignedPreKey: toMetadata(ecSignedPreKey),
      kemLastResortPreKey: toMetadata(kemLastResortPreKey),
      ecOneTimePreKeyCount: ecCount,
      kemOneTimePreKeyCount: kemCount,
    });
  } catch (error) {
    console.error("[E2EE] Prekey inventory failed:", error);

    return res.status(500).json({
      error: "Unable to retrieve prekey inventory",
    });
  }
});


// Retrieve metadata for a specific long-lived prekey.
router.get("/prekeys/metadata", async (req, res) => {
  try {
    const deviceId = Number(req.query.deviceId);
    const keyType = req.query.keyType;
    const identityType = req.query.identityType || "aci";

    if (
      !Number.isInteger(deviceId) ||
      deviceId < 1 ||
      deviceId > 5
    ) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    if (!PREKEY_METADATA_TYPES.includes(keyType)) {
      return res.status(400).json({ error: "Invalid metadata key type" });
    }

    if (!VALID_IDENTITY_TYPES.includes(identityType)) {
      return res.status(400).json({ error: "Invalid identity type" });
    }

    const device = await getOwnedEnabledDevice(
      req.user._id,
      req.deviceId,
      deviceId
    );

    if (!device) {
      return res.status(403).json({ error: "E2EE device not found" });
    }

    const key = await E2EEPreKey.findOne({
      userId: req.user._id,
      deviceId,
      identityType,
      type: keyType,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!key) {
      return res.status(404).json({
        error: "Prekey metadata not found",
      });
    }

    return res.json({
      keyId: key.keyId,
      publicKey: key.publicKey,
      createdAt: key.createdAt.getTime(),
      expiresAt: key.expiresAt
        ? key.expiresAt.getTime()
        : null,
    });
  } catch (error) {
    console.error("[E2EE] Prekey metadata retrieval failed:", error);

    return res.status(500).json({
      error: "Unable to retrieve prekey metadata",
    });
  }
});


// Remove expired KEM one-time prekeys only.
// Never delete the reusable KEM last-resort key here.
router.post("/prekeys/clear-stale-kem", async (req, res) => {
  try {
    const { deviceId, identityType = "aci" } = req.body;

    if (
      !Number.isInteger(deviceId) ||
      deviceId < 1 ||
      deviceId > 5
    ) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    if (!VALID_IDENTITY_TYPES.includes(identityType)) {
      return res.status(400).json({ error: "Invalid identity type" });
    }

    const device = await getOwnedEnabledDevice(
      req.user._id,
      req.deviceId,
      deviceId
    );

    if (!device) {
      return res.status(403).json({ error: "E2EE device not found" });
    }

    const result = await E2EEPreKey.deleteMany({
      userId: req.user._id,
      deviceId,
      identityType,
      type: "kemOneTimePreKey",
      expiresAt: {
        $ne: null,
        $lte: new Date(),
      },
    });

    return res.json({
      success: true,
      cleared: result.deletedCount,
    });
  } catch (error) {
    console.error("[E2EE] Stale KEM cleanup failed:", error);

    return res.status(500).json({
      error: "Unable to clear stale KEM prekeys",
    });
  }
});




export default router;