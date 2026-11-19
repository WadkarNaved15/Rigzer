
import {
  EncryptionError,
  EncryptionErrorCode,
} from "@open-e2ee/signal-protocol-sdk";
import type {
  SignalProtocolRelayServer,
} from "@open-e2ee/signal-protocol-sdk/remote/signal-relay/types";

import {
  webSqliteStore,
} from "@open-e2ee/signal-protocol-sdk/local/store/web-sqlite";

import {
  indexedDbStore,
} from "@open-e2ee/signal-protocol-sdk/local/store/web";

type E2EEStorage =
  | Awaited<ReturnType<typeof webSqliteStore>>
  | Awaited<ReturnType<typeof indexedDbStore>>;

let storagePromise: Promise<E2EEStorage> | null = null;

export function getE2EEStorage(): Promise<E2EEStorage> {
  if (!storagePromise) {
    storagePromise = (async () => {
      try {
        const storage = await webSqliteStore();

        console.info("[E2EE] Web SQLite storage initialized.");

        return storage;
      } catch (error) {
        if (
          error instanceof EncryptionError &&
          error.code === EncryptionErrorCode.OPFS_UNAVAILABLE
        ) {
          console.warn(
            "[E2EE] OPFS unavailable. Falling back to IndexedDB."
          );

          const storage = await indexedDbStore();

          console.info("[E2EE] IndexedDB storage initialized.");

          return storage;
        }

        throw error;
      }
    })().catch((error) => {
      storagePromise = null;
      throw error;
    });
  }

  return storagePromise;
}
