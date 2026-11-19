
import { createSignalProtocolClient } from "@open-e2ee/signal-protocol-sdk";
import { getE2EEStorage } from "./storage";
import { createRelayAdapter } from "./relayAdapter";
import {
  saveDecryptedMessage,
} from "../../lib/e2ee/messageStore";
import api from "../../utils/api";

type E2EEClient = Awaited<
  ReturnType<typeof createSignalProtocolClient>
>;

let clientPromise: Promise<E2EEClient> | null = null;
let activeUserId: string | null = null;
let activeDeviceId: number | null = null;

export async function getE2EEClient(
  userId: string,
  deviceId: number
): Promise<E2EEClient> {
  if (!userId) {
    throw new Error("An authenticated user ID is required for E2EE.");
  }

  if (!Number.isInteger(deviceId) || deviceId < 1 || deviceId > 5) {
    throw new Error("Invalid E2EE device ID.");
  }

  if (clientPromise) {
    if (
      activeUserId !== userId ||
      activeDeviceId !== deviceId
    ) {
      throw new Error(
        "An E2EE client is already initialized for another user or device."
      );
    }

    return clientPromise;
  }

  activeUserId = userId;
  activeDeviceId = deviceId;

  clientPromise = (async () => {
    const storage = await getE2EEStorage();
    const relay = createRelayAdapter(deviceId);

    const client = await createSignalProtocolClient({
      identity: {
        userId,
        deviceId,
      },
      adapters: {
        storage,
        relay,
      },
      onProgress: ({ stage, percent, message }) => {
        console.info("[E2EE Setup]", {
          stage,
          percent,
          message,
        });
      },
    });

    // Synchronize identity and prekeys.
    await client.syncToServer();




client.registerHook("onMessageDecrypted", async (envelope) => {
  try {
    const payload = JSON.parse(envelope.content);

    if (!payload?.chatId || !payload?.type) {
      console.warn("[E2EE] Unsupported message payload:", payload);
      return;
    }

    const senderId = envelope.senderId;
    const receiverId = userId;

    // Save decrypted content on THIS device, for THIS logged-in user.
    try {
      await saveDecryptedMessage({
        userId,
        e2eeMessageId: envelope.messageId,
        chatId: payload.chatId,
        senderId,
        receiverId,
        type: payload.type,
        text: typeof payload.text === "string" ? payload.text : "",
        timestamp: Number(envelope.timestamp) || Date.now(),
        replyTo: payload.replyTo ?? null,
      });

      console.info("[E2EE] Decrypted message saved locally:", {
        userId,
        chatId: payload.chatId,
        e2eeMessageId: envelope.messageId,
      });
    } catch (storageError) {
      console.error(
        "[E2EE] Failed to save decrypted message locally:",
        storageError
      );
    }

    // Save message metadata to MongoDB.
    let mongoMessageId: string | null = null;

    try {
      const response = await api.post(
        "/api/messages/e2ee/metadata",
        {
          chatId: payload.chatId,
          e2eeMessageId: envelope.messageId,
          senderId,
          receiverId,
          messageType: payload.type,
          replyTo: payload.replyTo ?? null,
          timestamp: envelope.timestamp,
        }
      );

      mongoMessageId = response.data?.data?._id ?? null;

      console.info("[E2EE] Message metadata saved:", {
        e2eeMessageId: envelope.messageId,
        mongoMessageId,
      });
    } catch (error) {
      console.error("[E2EE] Metadata persistence failed:", error);
    }

    // Update the UI even if local or metadata persistence failed.
    window.dispatchEvent(
      new CustomEvent("e2ee:message-decrypted", {
        detail: {
          ...envelope,
          payload,
          chatId: payload.chatId,
          mongoMessageId,
        },
      })
    );
  } catch (error) {
    console.error("[E2EE] Failed to process decrypted message:", error);
    throw error;
  }
});



    // Start receiving encrypted messages.
    client.startRelaySubscription();

    console.info("[E2EE] Client initialized and relay subscription started.", {
      userId,
      deviceId,
    });

    return client;
  })().catch((error) => {
    clientPromise = null;
    activeUserId = null;
    activeDeviceId = null;
    throw error;
  });

  return clientPromise;
}
