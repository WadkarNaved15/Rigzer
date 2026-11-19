
// src/lib/e2ee/messageStore.ts

const DB_NAME = "rigzer-e2ee-messages";
const STORE_NAME = "decrypted-messages";
const DB_VERSION = 1;

export interface StoredDecryptedMessage {
  key: string;
  userId: string;
  e2eeMessageId: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  type: string;
  text: string;
  timestamp: number;
  replyTo: unknown | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openMessageDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "key",
        });

        store.createIndex("by-user-chat", ["userId", "chatId"], {
          unique: false,
        });

        store.createIndex("by-user-message", ["userId", "e2eeMessageId"], {
          unique: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onblocked = () => {
      dbPromise = null;
      reject(new Error("Message database upgrade is blocked"));
    };
  });

  return dbPromise;
}

function makeKey(userId: string, e2eeMessageId: string): string {
  return `${userId}:${e2eeMessageId}`;
}

export async function saveDecryptedMessage(
  message: Omit<StoredDecryptedMessage, "key">
): Promise<void> {
  if (!message.userId || !message.e2eeMessageId || !message.chatId) {
    throw new Error("Missing required message identifiers");
  }

  const db = await openMessageDB();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.put({
      ...message,
      key: makeKey(message.userId, message.e2eeMessageId),
    } satisfies StoredDecryptedMessage);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Message save aborted"));
  });
}

export async function getDecryptedMessage(
  userId: string,
  e2eeMessageId: string
): Promise<StoredDecryptedMessage | null> {
  const db = await openMessageDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(
      makeKey(userId, e2eeMessageId)
    );

    request.onsuccess = () =>
      resolve((request.result as StoredDecryptedMessage | undefined) ?? null);

    request.onerror = () => reject(request.error);
  });
}

export async function getDecryptedMessages(
  userId: string,
  e2eeMessageIds: string[]
): Promise<Map<string, StoredDecryptedMessage>> {
  const uniqueIds = [...new Set(e2eeMessageIds.filter(Boolean))];

  const results = await Promise.all(
    uniqueIds.map((id) => getDecryptedMessage(userId, id))
  );

  const messages = new Map<string, StoredDecryptedMessage>();

  for (const message of results) {
    if (message) {
      messages.set(message.e2eeMessageId, message);
    }
  }

  return messages;
}

export async function getDecryptedMessagesForChat(
  userId: string,
  chatId: string
): Promise<StoredDecryptedMessage[]> {
  const db = await openMessageDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const index = transaction
      .objectStore(STORE_NAME)
      .index("by-user-chat");

    const request = index.getAll(IDBKeyRange.only([userId, chatId]));

    request.onsuccess = () =>
      resolve(request.result as StoredDecryptedMessage[]);

    request.onerror = () => reject(request.error);
  });
}
