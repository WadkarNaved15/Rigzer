
import axios from "axios";

import type {
  AccountIdentityProvisioning,
  CompositeIdentityV1,
  IdentityType,
  PreKeyBundle,
  PreKeyUpload,
  PreKeyInventory,
  Envelope,
  DeviceInfo,
DeviceRegistration,
} from "@open-e2ee/signal-protocol-sdk/remote/relay/types";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const E2EE_API = `${BACKEND_URL.replace(/\/$/, "")}/api/e2ee`;

const http = axios.create({
  baseURL: E2EE_API,
  withCredentials: true,
});

// These are branded Base64 string types in the SDK.
type PublicKey = CompositeIdentityV1["x25519PublicKey"];
type Signature = PreKeyBundle["ecSignedPreKey"]["signature"];

// Validate Base64 and its decoded byte length before branding it.
function validateBase64(
  value: string,
  expectedLength: number,
  fieldName: string
): void {
  if (typeof value !== "string" || !value) {
    throw new Error(`${fieldName} is missing.`);
  }

  let binary: string;

  try {
    binary = atob(value);
  } catch {
    throw new Error(`${fieldName} is not valid Base64.`);
  }

  if (btoa(binary) !== value) {
    throw new Error(`${fieldName} is not canonical Base64.`);
  }

  if (binary.length !== expectedLength) {
    throw new Error(
      `${fieldName} must decode to ${expectedLength} bytes. Received ${binary.length}.`
    );
  }
}

function asPublicKey(
  value: string,
  expectedLength: number,
  fieldName: string
): PublicKey {
  validateBase64(value, expectedLength, fieldName);
  return value as PublicKey;
}

function asSignature(
  value: string,
  fieldName: string
): Signature {
  validateBase64(value, 64, fieldName);
  return value as Signature;
}

interface BackendIdentity {
  version: 1;
  x25519PublicKey: string;
  ed25519PublicKey: string;
}

function toBackendIdentity(identity: CompositeIdentityV1) {
  return {
    version: identity.version,
    x25519PublicKey: identity.x25519PublicKey,
    ed25519PublicKey: identity.ed25519PublicKey,
  };
}

function toSdkIdentity(identity: BackendIdentity): CompositeIdentityV1 {
  return {
    version: 1,
    x25519PublicKey: asPublicKey(
      identity.x25519PublicKey,
      32,
      "Identity X25519 public key"
    ),
    ed25519PublicKey: asPublicKey(
      identity.ed25519PublicKey,
      32,
      "Identity Ed25519 public key"
    ),
  };
}

// Provision account-level identity.
export async function provisionIdentity(
  request: AccountIdentityProvisioning
): Promise<void> {
  await http.post("/identity/provision", {
    deviceId: request.deviceId,
    registrationId: request.registrationId,
    identity: toBackendIdentity(request.identity),
    identityType: request.identityType ?? "aci",
  });
}

// Retrieve another user's public identity.
export async function getIdentity(
  userId: string,
  identityType: IdentityType = "aci"
): Promise<CompositeIdentityV1 | null> {
  try {
    const response = await http.get<{
      identityType: IdentityType;
      identity: BackendIdentity;
    }>(`/users/${encodeURIComponent(userId)}/identity`, {
      params: { identityType },
    });

    return toSdkIdentity(response.data.identity);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
}

// Upload public prekeys.
export async function uploadPreKeys(
  userId: string,
  deviceId: number,
  keys: PreKeyUpload[],
  identityType: IdentityType = "aci"
): Promise<void> {
  // Authentication determines the owner on the backend.
  void userId;

  await http.post("/prekeys", {
    deviceId,
    identityType,
    keys,
  });
}

interface BackendPreKeyBundle {
  userId: string;
  deviceId: number;
  registrationId: number;
  identityType: IdentityType;
  identity: BackendIdentity;

  signedPreKey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };

  ecOneTimePreKey: {
    keyId: number;
    publicKey: string;
  } | null;

  kemPreKey: {
    keyId: number;
    publicKey: string;
    signature: string;
    isLastResort: boolean;
  };
}

// Retrieve and convert a recipient's prekey bundle.
export async function fetchPreKeyBundle(
  userId: string,
  deviceId: number,
  identityType: IdentityType = "aci"
): Promise<PreKeyBundle | null> {
  try {
    const response = await http.get<BackendPreKeyBundle>(
      `/users/${encodeURIComponent(userId)}/devices/${deviceId}/prekey-bundle`,
      {
        params: { identityType },
      }
    );

    const bundle = response.data;

    const kemKey = {
      keyId: bundle.kemPreKey.keyId,
      publicKey: asPublicKey(
        bundle.kemPreKey.publicKey,
        1569,
        "KEM prekey public key"
      ),
      signature: asSignature(
        bundle.kemPreKey.signature,
        "KEM prekey signature"
      ),
    };

    return {
      registrationId: bundle.registrationId,
      deviceId: bundle.deviceId,

      identity: toSdkIdentity(bundle.identity),

      ecSignedPreKey: {
        keyId: bundle.signedPreKey.keyId,
        publicKey: asPublicKey(
          bundle.signedPreKey.publicKey,
          32,
          "EC signed prekey public key"
        ),
        signature: asSignature(
          bundle.signedPreKey.signature,
          "EC signed prekey signature"
        ),
      },

      ecOneTimePreKey: bundle.ecOneTimePreKey
        ? {
            keyId: bundle.ecOneTimePreKey.keyId,
            publicKey: asPublicKey(
              bundle.ecOneTimePreKey.publicKey,
              32,
              "EC one-time prekey public key"
            ),
          }
        : null,

      kemOneTimePreKey: bundle.kemPreKey.isLastResort
        ? null
        : kemKey,

      kemLastResortPreKey: bundle.kemPreKey.isLastResort
        ? kemKey
        : null,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
}

const NEVER_EXPIRES = Number.MAX_SAFE_INTEGER;

function toSdkPreKeyMetadata(
  metadata: {
    keyId: number;
    publicKey: string;
    createdAt: number;
    expiresAt: number | null;
  } | null
) {
  if (!metadata) return null;

  return {
    keyId: metadata.keyId,
    publicKey: metadata.publicKey,
    createdAt: metadata.createdAt,
    // The backend currently stores reusable keys without an expiry.
    expiresAt: metadata.expiresAt ?? NEVER_EXPIRES,
  };
}

export async function getPreKeyCount(
  userId: string,
  deviceId: number,
  type: "ec" | "kem",
  identityType: IdentityType = "aci"
): Promise<number> {
  void userId; // Ownership is determined by backend authentication.

  const { data } = await http.get("/prekeys/count", {
    params: { deviceId, type, identityType },
  });

  return data.count;
}

export async function getPreKeyInventory(
  userId: string,
  deviceId: number,
  identityType: IdentityType = "aci"
): Promise<PreKeyInventory> {
  void userId;

  const { data } = await http.get("/prekeys/inventory", {
    params: { deviceId, identityType },
  });

  return {
    ecSignedPreKey: toSdkPreKeyMetadata(data.ecSignedPreKey),
    kemLastResortPreKey: toSdkPreKeyMetadata(data.kemLastResortPreKey),
    ecOneTimePreKeyCount: data.ecOneTimePreKeyCount,
    kemOneTimePreKeyCount: data.kemOneTimePreKeyCount,
  };
}

export async function getEcSignedPreKeyMetadata(
  userId: string,
  deviceId: number,
  identityType: IdentityType = "aci"
) {
  void userId;

  const { data } = await http.get("/prekeys/metadata", {
    params: {
      deviceId,
      keyType: "ecSignedPreKey",
      identityType,
    },
  });

  return toSdkPreKeyMetadata(data);
}

export async function getKemLastResortPreKeyMetadata(
  userId: string,
  deviceId: number,
  identityType: IdentityType = "aci"
) {
  void userId;

  const { data } = await http.get("/prekeys/metadata", {
    params: {
      deviceId,
      keyType: "kemLastResortPreKey",
      identityType,
    },
  });

  return toSdkPreKeyMetadata(data);
}

export async function clearStaleKemPreKeys(
  userId: string,
  deviceId: number,
  identityType: IdentityType = "aci"
): Promise<{ cleared: number }> {
  void userId;

  const { data } = await http.post("/prekeys/clear-stale-kem", {
    deviceId,
    identityType,
  });

  return { cleared: data.cleared };
}


function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  return btoa(binary);
}

function envelopeCiphertextToBase64(
  ciphertext: string | Uint8Array
): string {
  return typeof ciphertext === "string"
    ? ciphertext
    : bytesToBase64(ciphertext);
}

// Send one encrypted envelope.
export async function sendEnvelope(envelope: Envelope) {
  const { data } = await http.post("/envelopes", {
    senderDeviceId: envelope.senderDeviceId,
    targetUserId: envelope.targetUserId,
    targetDeviceId: envelope.targetDeviceId,
    ciphertext: envelopeCiphertextToBase64(envelope.ciphertext),
    messageType: envelope.messageType,
    deliveryClass: envelope.deliveryClass,
    contentKind: envelope.contentKind ?? null,
    clientMessageId: envelope.clientMessageId ?? null,
    timestamp: envelope.timestamp,
    operationEpochMilliseconds:
      envelope.operationEpochMilliseconds ?? null,
    declaredDeviceIds: envelope.declaredDeviceIds ?? [],
    recipientRegistrationId:
      envelope.recipientRegistrationId ?? null,
    contentHint: envelope.contentHint ?? null,
  });

  return data as {
    messageId: string;
    serverTimestamp: number;
    duplicate?: boolean;
    expiresAt?: number | null;
  };
}

// Retrieve pending encrypted envelopes.
export async function getMailbox(deviceId: number) {
  const { data } = await http.get("/mailbox", {
    params: { deviceId },
  });

  return data.envelopes as Envelope[];
}

// Acknowledge successful processing of an envelope.
export async function acknowledgeEnvelope(
  envelopeId: string,
  deviceId: number
): Promise<void> {
  await http.post(
    `/envelopes/${encodeURIComponent(envelopeId)}/ack`,
    { deviceId }
  );
}


function dateToMilliseconds(value: string | number | null | undefined) {
  if (value == null) return null;

  const timestamp =
    typeof value === "number" ? value : new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

// Retrieve active, registered devices for a user.
export async function getRegisteredDevices(
  userId: string
): Promise<DeviceInfo[]> {
  const { data } = await http.get(
    `/users/${encodeURIComponent(userId)}/devices`
  );

  return data.devices.map((device: any): DeviceInfo => {
    const lastSeenAt = dateToMilliseconds(device.lastSeenAt);
    const createdAt = dateToMilliseconds(device.createdAt);
    const linkedAt = dateToMilliseconds(device.linkedAt);

    return {
      deviceId: device.deviceId,
      deviceType: device.deviceType,
      registered: device.registered,
      linked: device.linked,
      enabled: device.enabled,
      lastSeenAt,
      ...(createdAt !== null ? { createdAt } : {}),
      ...(linkedAt !== null ? { linkedAt } : {}),
      ...(device.encryptedDeviceName
        ? {
            encryptedDeviceName: base64ToArrayBuffer(
              device.encryptedDeviceName
            ),
          }
        : {}),
    };
  });
}

// Register the current browser as the primary E2EE device.
export async function registerCurrentBrowser(
  userId: string,
  device: DeviceRegistration
): Promise<number> {
  void userId; // Backend derives the authenticated user.

  const { data } = await http.post("/devices/register", {
    deviceType: device.deviceType ?? "web",
    encryptedDeviceNameBase64: device.encryptedDeviceName
      ? bytesToBase64(new Uint8Array(device.encryptedDeviceName))
      : null,
  });

  return data.deviceId as number;
}


