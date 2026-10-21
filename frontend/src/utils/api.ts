
import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
});

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<void> | null = null;


const refreshSession = async (): Promise<void> => {
  const performRefresh = async () => {
    await refreshClient.post("/api/auth/refresh");
  };

  // Serialize refresh requests across browser tabs where supported.
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request("rigzer-auth-refresh", async () => {
      await performRefresh();
    });

    return;
  }

  // Fallback for browsers without Web Locks support.
  await performRefresh();
};

api.interceptors.request.use(
  (config) => {
    const sessionId = localStorage.getItem(
      "rigzer_analytics_session"
    );

    if (sessionId) {
      config.headers["x-session-id"] = sessionId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest =
      error.config as RetryableRequestConfig | undefined;

    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url ?? "";

    // Never attempt to refresh recursively, or retry login-related
    // requests whose 401 responses are expected.
    const excludedPaths = [
      "/api/auth/refresh",
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/verify-email",
      "/api/auth/google-complete",
    ];

    if (
      originalRequest._retry ||
      excludedPaths.some((path) => requestUrl.includes(path))
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshSession().finally(() => {
          refreshPromise = null;
        });
      }

      await refreshPromise;
      return api(originalRequest);
    } catch (refreshError) {
      const refreshStatus = (refreshError as AxiosError).response?.status;

      // A 401 from the refresh endpoint means the session
      // cannot be renewed. Notify UserContext to clear stale auth state.
      if (refreshStatus === 401 && typeof window !== "undefined") {
        window.dispatchEvent(new Event("rigzer:session-expired"));
      }

      // Do not sign the user out for recoverable conflicts,
      // network failures, or server errors.
      return Promise.reject(refreshError);
    }
  }
);

export default api;
