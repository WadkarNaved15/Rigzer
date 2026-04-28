import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { Loader2, ChevronRight, XCircle, AlertTriangle } from "lucide-react";

type AdWithStatusProps = {
  sessionId: string;
};

interface Ad {
  _id: string;
  title?: string;
  mediaType: "video" | "image";
  mediaUrl: string;
  redirectUrl: string;
  logoUrl?: string | null;
}

type SessionError = "failed" | "ended" | "stream_error" | null;

const stepsMap: { [key: string]: string } = {
  waiting: "Preparing Cloud Instance",
  assigning: "Assigning Cloud Instance",
  starting: "Initializing Session",
  downloading: "Downloading Game",
  launching: "Launching Game",
  running: "Stream Ready",
  failed: "Session Failed",
  ended: "Session Ended",
};

const orderedSteps = [
  "waiting",
  "assigning",
  "starting",
  "downloading",
  "launching",
  "running",
];

export default function AdWithStatus({ sessionId }: AdWithStatusProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<string>("waiting");
  const [ad, setAd] = useState<Ad | null>(null);
  const [canSkip, setCanSkip] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamUrlError, setStreamUrlError] = useState(false);
  const [sessionError, setSessionError] = useState<SessionError>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Refs to avoid stale closures in SSE handler
  const fetchRetryCount = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const handleTerminalState = useCallback((state: "failed" | "ended") => {

  // 🔴 Clear stale session state
  localStorage.removeItem("session");
  localStorage.removeItem("queue");

  if (state === "failed") {
    setSessionError("failed");
    setErrorMessage("Your session failed to start. This is usually due to a server issue. Please try again.");
  } else {
    setSessionError("ended");
    setErrorMessage("Your session has ended.");
  }

  setSessionStatus(state);

  if (pollRef.current) {
    clearInterval(pollRef.current);
    pollRef.current = null;
  }

}, []);

  const fetchStreamUrl = useCallback(async () => {
    const MAX_RETRIES = 5;
    if (fetchRetryCount.current >= MAX_RETRIES) {
      setStreamUrlError(true);
      return;
    }
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/sessions/${sessionId}/stream-token`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setStreamUrl(data.streamUrl);
        fetchRetryCount.current = 0;
      } else {
        fetchRetryCount.current += 1;
        const backoff = Math.min(1000 * 2 ** fetchRetryCount.current, 10000);
        setTimeout(fetchStreamUrl, backoff);
      }
    } catch (err) {
      console.error("Failed to fetch stream URL:", err);
      fetchRetryCount.current += 1;
      if (fetchRetryCount.current >= MAX_RETRIES) {
        setStreamUrlError(true);
      } else {
        setTimeout(fetchStreamUrl, 3000);
      }
    }
  }, [sessionId, BACKEND_URL]);

  // Fallback poll — catches missed SSE events (multi-instance backend, dropped connections)
  const startFallbackPoll = useCallback(() => {
    if (pollRef.current) return; // already polling
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/sessions/${sessionId}/status`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const { status, phase } = await res.json();

        if (status === "failed") {
          handleTerminalState("failed");
        } else if (status === "ended") {
          handleTerminalState("ended");
        } else if (status === "running") {
          setCanSkip(true);
          setSessionStatus("running");
          setCurrentStepIndex(orderedSteps.indexOf("running"));
          fetchStreamUrl();
        } else {
          const effectiveStatus = phase ?? status;
          const stepIndex = orderedSteps.indexOf(effectiveStatus);
          if (stepIndex !== -1) {
            setCurrentStepIndex(stepIndex);
            setSessionStatus(effectiveStatus);
          }
        }
      } catch {
        // silent — SSE is the primary channel
      }
    }, 6000);
  }, [sessionId, BACKEND_URL, handleTerminalState, fetchStreamUrl]);

  // Fetch ad
  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/api/ads/fairadd`)
      .then((res) => setAd(res.data))
      .catch((err) => console.error("Failed to load ad:", err));
  }, [BACKEND_URL]);

  // SSE connection
  useEffect(() => {
    if (!sessionId) return;

    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let reconnectAttempts = 0;
    const MAX_RECONNECT = 8;

    const connect = () => {
      es = new EventSource(
        `${BACKEND_URL}/api/sessions/${sessionId}/events`,
        { withCredentials: true }
      );

      es.onmessage = (e) => {
        reconnectAttempts = 0; // reset on successful message
        const { status, phase } = JSON.parse(e.data);

        const effectiveStatus =
          status === "running" || status === "ended" || status === "failed"
            ? status
            : phase ?? status;

        if (effectiveStatus === "failed") {
          handleTerminalState("failed");
          es.close();
          return;
        }

        if (effectiveStatus === "ended") {
          handleTerminalState("ended");
          es.close();
          return;
        }

        setSessionStatus(effectiveStatus);
        const stepIndex = orderedSteps.indexOf(effectiveStatus);
        if (stepIndex !== -1) setCurrentStepIndex(stepIndex);

        if (effectiveStatus === "running") {
          setCanSkip(true);
          fetchStreamUrl();
          // Stop fallback poll — SSE is working
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      };

      es.onerror = () => {
        es.close();
        reconnectAttempts += 1;
        if (reconnectAttempts > MAX_RECONNECT) {
          console.error("SSE permanently failed, relying on poll");
          // Poll takes over completely
          startFallbackPoll();
          return;
        }
        // Exponential backoff reconnect: 1s, 2s, 4s … capped at 15s
        const delay = Math.min(1000 * 2 ** reconnectAttempts, 15000);
        console.warn(`SSE error — reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    startFallbackPoll(); // always run poll as safety net

    return () => {
      es?.close();
      clearTimeout(reconnectTimer);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [sessionId, BACKEND_URL, fetchStreamUrl, handleTerminalState, startFallbackPoll]);

  // Heartbeat + abandon beacon
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(() => {
      navigator.sendBeacon(`${BACKEND_URL}/api/sessions/${sessionId}/heartbeat`);
    }, 10_000);

    const handleUnload = () => {
      navigator.sendBeacon(
        `${BACKEND_URL}/api/sessions/${sessionId}/abandon/${import.meta.env.VITE_ABANDON_SECRET}`,
        new Blob([JSON.stringify({})], { type: "application/json" })
      );
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [sessionId, BACKEND_URL]);

  const handleAdClick = async () => {
    if (!ad) return;
    try {
      await axios.post(`${BACKEND_URL}/api/ads/click/${ad._id}`);
    } catch {}
    window.open(ad.redirectUrl, "_blank");
  };

  const cancelSession = async () => {
    if (!sessionId) return;
    if (!confirm("Are you sure you want to cancel this session? Your game session will be terminated.")) return;
    try {
      await axios.post(
        `${BACKEND_URL}/api/sessions/${sessionId}/cancel`,
        {},
        { withCredentials: true }
      );
      localStorage.removeItem("queue");
      localStorage.removeItem("session");
      window.location.href = "/";
    } catch (err) {
      console.error("Cancel session error:", err);
      setSessionError("failed");
      setErrorMessage("Failed to cancel the session. Please refresh and try again.");
    }
  };

  const handleLaunch = () => {
    if (streamUrl) window.location.href = streamUrl;
  };

  const handleRetry = () => {
    localStorage.removeItem("queue");
    localStorage.removeItem("session");
    window.location.href = "/";
  };

  // ── Error overlay ──────────────────────────────────────────────────────────
  if (sessionError === "failed" || sessionError === "stream_error") {
    return (
      <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col items-center justify-center space-y-6 p-8">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center">
            <AlertTriangle className="text-red-500" size={28} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Session Failed
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            {errorMessage}
          </p>
          <button
            onClick={handleRetry}
            className="mt-2 px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl text-sm font-semibold hover:opacity-90 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (sessionError === "ended") {
    return (
      <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col items-center justify-center space-y-6 p-8">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
            <XCircle className="text-gray-400 dark:text-gray-500" size={28} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Session Ended
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {errorMessage}
          </p>
          <button
            onClick={handleRetry}
            className="mt-2 px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl text-sm font-semibold hover:opacity-90 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Loading (no ad yet) ────────────────────────────────────────────────────
  if (!ad) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-[#0a0a0a] z-50 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-gray-400 dark:text-gray-600" size={32} />
        <span className="text-gray-400 dark:text-gray-600 text-xs tracking-[0.3em] uppercase font-medium">
          Initializing
        </span>
      </div>
    );
  }

  // ── Main ad screen ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col font-sans overflow-hidden select-none">

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 p-6 z-20">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div
            className="flex items-center space-x-3 bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-gray-800 p-2 pr-4 rounded-xl cursor-pointer shadow-sm"
            onClick={handleAdClick}
          >
            {ad.logoUrl && ad.logoUrl !== "null" && (
              <img src={ad.logoUrl} alt="Sponsor" className="h-7 w-auto object-contain" />
            )}
            <div className="flex flex-col border-l border-gray-200 dark:border-gray-700 pl-3">
              <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] leading-none mb-1 font-bold">
                Sponsored
              </span>
              <span className="text-gray-900 dark:text-white text-xs font-semibold tracking-wide">
                {ad.title || "Partner Content"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AD CONTENT */}
      <div className="relative flex-grow flex items-center justify-center bg-gray-50 dark:bg-black">
        {ad.mediaType === "video" ? (
          <video
            autoPlay muted loop playsInline
            className="w-full h-full object-contain cursor-pointer"
            src={ad.mediaUrl}
            onClick={handleAdClick}
          />
        ) : (
          <img
            src={ad.mediaUrl}
            className="w-full h-full object-contain cursor-pointer"
            onClick={handleAdClick}
            alt="Advertisement"
          />
        )}
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white dark:from-black to-transparent">
        <div className="max-w-7xl mx-auto flex items-end justify-between">

          {/* PROGRESS */}
          <div className="flex flex-col space-y-2 w-56 bg-white/50 dark:bg-black/20 backdrop-blur-sm p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/50">
            <div className="flex items-center space-x-2">
              {sessionStatus !== "running" && (
                <div className="w-2.5 h-2.5 border-2 border-gray-400 dark:border-gray-500 border-t-gray-700 dark:border-t-gray-200 rounded-full animate-spin flex-shrink-0" />
              )}
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate">
                {stepsMap[sessionStatus] || sessionStatus}
              </span>
            </div>
            <div className="flex space-x-1 h-[3px] w-full">
              {orderedSteps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-full flex-grow rounded-full transition-all duration-700 ${
                    idx < currentStepIndex
                      ? "bg-gray-600 dark:bg-gray-300"
                      : idx === currentStepIndex
                      ? "bg-gray-400 dark:bg-gray-500 animate-pulse"
                      : "bg-gray-200 dark:bg-gray-800"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-col items-end gap-3">
            {canSkip ? (
              <>
                <button
                  onClick={handleLaunch}
                  disabled={!streamUrl}
                  className="group flex items-center space-x-3 bg-gray-800 dark:bg-gray-200 text-white dark:text-black px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {streamUrl ? (
                    <>
                      <span>LAUNCH SESSION</span>
                      <ChevronRight size={18} />
                    </>
                  ) : (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>CONNECTING...</span>
                    </>
                  )}
                </button>
                {streamUrlError && (
                  <button
                    onClick={() => {
                      setStreamUrlError(false);
                      fetchRetryCount.current = 0;
                      fetchStreamUrl();
                    }}
                    className="text-xs text-gray-500 underline"
                  >
                    Retry connection
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center space-x-3 bg-white/80 dark:bg-black/40 backdrop-blur-md px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-500 text-[10px] font-bold tracking-widest uppercase shadow-sm">
                <div className="w-3 h-3 border-2 border-gray-300 dark:border-gray-700 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
                <span>Preparing Session</span>
              </div>
            )}

            <button
              onClick={cancelSession}
              className="text-xs font-bold text-red-500 border border-red-500/40 px-5 py-2 rounded-lg hover:bg-red-500/10 transition"
            >
              Cancel Session
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}