
import axios from "axios";
import { getE2EEClient } from "./client";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Change this if your backend mounts e2eeRoutes at another path.
const E2EE_API = `${BACKEND_URL}/api/e2ee`;

interface RegisterDeviceResponse {
  deviceId: number;
  registered: boolean;
  existing: boolean;
}

export async function registerAndInitializeE2EE(
  userId: string
) {
  if (!userId) {
    throw new Error("User ID is required for E2EE registration.");
  }

  // Register this browser with the authenticated backend.
  const response = await axios.post<RegisterDeviceResponse>(
    `${E2EE_API}/devices/register`,
    {
      deviceType: "web",
    },
    {
      withCredentials: true,
    }
  );

  const { deviceId, registered, existing } = response.data;

  if (!Number.isInteger(deviceId) || deviceId < 1 || deviceId > 5) {
    throw new Error("Backend returned an invalid E2EE device ID.");
  }

  console.info("[E2EE] Browser device registered.", {
    deviceId,
    registered,
    existing,
  });

  // Initialize the SDK with the device ID assigned by the backend.
  const client = await getE2EEClient(userId, deviceId);

  return {
    client,
    deviceId,
    registered,
    existing,
  };
}
