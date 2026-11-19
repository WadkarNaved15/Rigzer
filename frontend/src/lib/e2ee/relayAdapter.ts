
import type {
  SignalProtocolRelayServer,
  SignalProtocolRelayConnectionState,
} from "@open-e2ee/signal-protocol-sdk/remote/relay/types";

import {
  sendEnvelope,
  getMailbox,
  acknowledgeEnvelope,
  getRegisteredDevices,
  registerCurrentBrowser,
  provisionIdentity,
  getIdentity,
  uploadPreKeys,
  fetchPreKeyBundle,
  getPreKeyCount,
  getPreKeyInventory,
  clearStaleKemPreKeys,
  getEcSignedPreKeyMetadata,
  getKemLastResortPreKeyMetadata,
} from "./relay";

const POLL_INTERVAL_MS = 15000;

const unsupportedGroupOperation = (operation: string) => {
  return () => {
    const error = new Error(
      `[E2EE] Unsupported adapter operation: ${operation}`
    );

    console.error(error.stack);
    throw error;
  };
};

export function createRelayAdapter(
  currentDeviceId: number
): SignalProtocolRelayServer {
  if (!Number.isInteger(currentDeviceId) || currentDeviceId < 1) {
    throw new Error("A valid current device ID is required.");
  }

  let connectionState: SignalProtocolRelayConnectionState = {
    state: "stopped",
    since: Date.now(),
  };

  const connectionListeners = new Set<
    (state: SignalProtocolRelayConnectionState) => void
  >();

  function updateConnectionState(
    state: SignalProtocolRelayConnectionState["state"],
    reason?: SignalProtocolRelayConnectionState["reason"]
  ) {
    if (
      connectionState.state === state &&
      connectionState.reason === reason
    ) {
      return;
    }

    connectionState = {
      state,
      ...(reason ? { reason } : {}),
      since: Date.now(),
    };

    connectionListeners.forEach((listener) => {
      try {
        listener(connectionState);
      } catch (error) {
        console.error("[E2EE] Connection listener failed:", error);
      }
    });
  }

  const publicationLocks = new Map<string, Promise<void>>();

  async function publishWithLock(
    userId: string,
    deviceId: number,
    plan: Parameters<
      SignalProtocolRelayServer["publishPlannedPreKeys"]
    >[2],
    identityType?: Parameters<
      SignalProtocolRelayServer["publishPlannedPreKeys"]
    >[3]
  ) {
    const lockKey = `${userId}:${deviceId}:${identityType ?? "aci"}`;

    const previous = publicationLocks.get(lockKey) ?? Promise.resolve();

    const current = previous.then(async () => {
      const inventory = await getPreKeyInventory(
        userId,
        deviceId,
        identityType
      );

      const keys = await plan(inventory);

      if (keys.length > 0) {
        await uploadPreKeys(userId, deviceId, [...keys], identityType);
      }
    });

    publicationLocks.set(lockKey, current);

    try {
      await current;
    } finally {
      if (publicationLocks.get(lockKey) === current) {
        publicationLocks.delete(lockKey);
      }
    }
  }

  return {
    get relayConnectionState() {
      return connectionState;
    },

    subscribeRelayConnectionState(listener) {
      connectionListeners.add(listener);

      return () => {
        connectionListeners.delete(listener);
      };
    },

    async send(envelope) {
    const result = await sendEnvelope(envelope);

    return {
        messageId: result.messageId,
        serverTimestamp: result.serverTimestamp,
        ...(result.duplicate !== undefined
        ? { duplicate: result.duplicate }
        : {}),
        ...(result.expiresAt != null
        ? { expiresAt: result.expiresAt }
        : {}),
    };
    },

    subscribe(userId, deviceId, onEnvelope, options) {
      let stopped = false;
      let polling = false;
      let batchOpen = false;

      const finishBatch = () => {
        if (!batchOpen) return;

        batchOpen = false;

        try {
          options?.onBatchEnd?.();
        } catch (error) {
          console.error("[E2EE] Batch-end callback failed:", error);
        }
      };

      const poll = async () => {
        if (stopped || polling) return;

        polling = true;

        try {
          const envelopes = await getMailbox(deviceId);

          updateConnectionState("connected");

          if (envelopes.length === 0) {
            finishBatch();
            return;
          }

          if (!batchOpen) {
            batchOpen = true;

            try {
              options?.onBatchStart?.();
            } catch (error) {
              console.error("[E2EE] Batch-start callback failed:", error);
            }
          }

          for (const envelope of envelopes) {
            if (stopped) break;

            if (!envelope.id) {
              console.error(
                "[E2EE] Received an envelope without a server ID."
              );
              continue;
            }

            try {
              // Resolve only after the SDK has successfully processed it.
              await onEnvelope(envelope);

              // Acknowledge after successful processing.
              await acknowledgeEnvelope(envelope.id, deviceId);
            } catch (error) {
              // Leave the envelope pending so it can be retried.
              console.error(
                "[E2EE] Envelope processing failed; it will be retried:",
                error
              );
            }
          }

          finishBatch();
        } catch (error) {
          updateConnectionState(
            "reconnecting",
            "error"
          );

          console.error("[E2EE] Mailbox polling failed:", error);
        } finally {
          polling = false;
        }
      };

      updateConnectionState("connecting");

      void poll();

      const interval = setInterval(() => {
        void poll();
      }, POLL_INTERVAL_MS);

      const handleEnvelopeAvailable = (event: Event) => {
  const detail = (
    event as CustomEvent<{
      targetDeviceId?: number;
    }>
  ).detail;

  if (detail?.targetDeviceId !== deviceId) {
    return;
  }

  console.info("[E2EE] New envelope notification received:", detail);

  void poll();
};

window.addEventListener(
  "e2ee:envelope-available",
  handleEnvelopeAvailable
);

      return () => {
        if (stopped) return;

        stopped = true;
        clearInterval(interval);
        window.removeEventListener(
  "e2ee:envelope-available",
  handleEnvelopeAvailable
);
        finishBatch();
        updateConnectionState("stopped");
      };
    },

    async markDelivered(envelopeId) {
      await acknowledgeEnvelope(envelopeId, currentDeviceId);
    },

async getDevices(userId: string) {
  console.log("[E2EE] getDevices called:", userId);

  const result = await getRegisteredDevices(userId);

  console.log("[E2EE] getDevices result:", result);

  return result;
},

    async registerDevice(userId, device) {
      const registeredDeviceId = await registerCurrentBrowser(
        userId,
        device
      );

      if (
        device.deviceId !== undefined &&
        device.deviceId !== registeredDeviceId
      ) {
        throw new Error(
          "The backend registered a different device ID than requested."
        );
      }

      return registeredDeviceId;
    },

    async removeDevice() {
      throw new Error(
        "Device removal is not implemented by this backend yet."
      );
    },

    async provisionIdentityKey(request) {
      await provisionIdentity(request);
    },

    async rotateIdentityKey() {
      throw new Error(
        "Identity rotation is not implemented by this backend yet."
      );
    },

    async getIdentityKey(userId, identityType) {
      return getIdentity(userId, identityType);
    },

    async uploadPreKeys(userId, deviceId, keys, identityType) {
      await uploadPreKeys(userId, deviceId, keys, identityType);
    },

    async fetchPreKeyBundle(
      userId,
      deviceId,
      _fetcherUserId,
      identityType
    ) {
      return fetchPreKeyBundle(userId, deviceId, identityType);
    },

    async getPreKeyCount(userId, deviceId, type, identityType) {
      return getPreKeyCount(userId, deviceId, type, identityType);
    },

    async getPreKeyInventory(userId, deviceId, identityType) {
      return getPreKeyInventory(userId, deviceId, identityType);
    },

    async clearStaleKemPreKeys(userId, deviceId, identityType) {
      return clearStaleKemPreKeys(userId, deviceId, identityType);
    },

    async publishPlannedPreKeys(
      userId,
      deviceId,
      plan,
      identityType
    ) {
      await publishWithLock(userId, deviceId, plan, identityType);
    },

    async getEcSignedPreKeyMetadata(
      userId,
      deviceId,
      identityType
    ) {
      return getEcSignedPreKeyMetadata(
        userId,
        deviceId,
        identityType
      );
    },

    async getKemLastResortPreKeyMetadata(
      userId,
      deviceId,
      identityType
    ) {
      return getKemLastResortPreKeyMetadata(
        userId,
        deviceId,
        identityType
      );
    },

    // Group operations are deliberately unsupported for now.
    async getActiveDevices(userId: string) {
        console.log("[E2EE] getActiveDevices called:", userId);

        const devices = await getRegisteredDevices(userId);

        console.log("[E2EE] Backend registered devices:", devices);

        const activeDevices = devices
            .filter((device) => device.enabled && device.registered)
            .map((device) => ({
            userId,
            deviceId: device.deviceId,
            }));

        console.log("[E2EE] Active devices returned to SDK:", activeDevices);

        return activeDevices;
        },

    async createGroupState() {
      return unsupportedGroupOperation("createGroupState")();
    },

    async getGroupState() {
      return unsupportedGroupOperation("getGroupState")();
    },

    async getGroupJoinInfo() {
      return unsupportedGroupOperation("getGroupJoinInfo")();
    },

    async getGroupChanges() {
      return unsupportedGroupOperation("getGroupChanges")();
    },

    async submitGroupChange() {
      return unsupportedGroupOperation("submitGroupChange")();
    },

    async issueAuthCredential() {
      return unsupportedGroupOperation("issueAuthCredential")();
    },
  } satisfies SignalProtocolRelayServer;
}
