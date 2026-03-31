import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Loader2, ChevronRight } from "lucide-react";

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
  impressions?: number;
  clicks?: number;
  isActive?: boolean;
}

const stepsMap: { [key: string]: string } = {
  waiting: "Preparing Cloud Instance",
  assigning: "Assigning Cloud Instance",
  starting: "Initializing Session",
  downloading: "Downloading Game",
  launching: "Launching Game",
  running: "Stream Ready",
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

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // ✅ Separate async function to fetch stream URL
  const fetchStreamUrl = useCallback(async () => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/sessions/${sessionId}/stream-token`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setStreamUrl(data.streamUrl);
      } else {
        // Retry once after 2s if not ready yet
        setTimeout(fetchStreamUrl, 2000);
      }
    } catch (err) {
      console.error("Failed to fetch stream URL:", err);
      setStreamUrlError(true);
    }
  }, [sessionId, BACKEND_URL]);

  // Fetch ad
  useEffect(() => {
    const loadAd = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/ads/fairadd`);
        setAd(res.data);
      } catch (err) {
        console.error("Failed to load ad:", err);
      }
    };
    loadAd();
  }, []);

  // ✅ SSE — no async, no await inside handler
  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(
      `${BACKEND_URL}/api/sessions/${sessionId}/events`,
      { withCredentials: true }
    );
    console.log("SSE client connected:", sessionId);

    es.onmessage = (e) => {
      const { status, phase } = JSON.parse(e.data);

      console.log("Sending SSE update:", sessionId, status, phase);

      const effectiveStatus =
        status === "running" || status === "ended" || status === "failed"
          ? status
          : phase ?? status;

      setSessionStatus(effectiveStatus);

      const stepIndex = orderedSteps.indexOf(effectiveStatus);
      if (stepIndex !== -1) {
        setCurrentStepIndex(stepIndex);
      }

      // ✅ Trigger async fetch separately — don't await in handler
      if (effectiveStatus === "running") {
        setCanSkip(true);
        fetchStreamUrl();  // fire and forget — state update happens inside
      }

      if (effectiveStatus === "failed") {
        alert("Failed to start game session.");
        es.close();
      }

      if (effectiveStatus === "ended") {
        alert("Session ended.");
        es.close();
      }
    };

    es.onerror = () => {
      console.warn("SSE connection lost, retrying...");
    };

    return () => es.close();
  }, [sessionId, fetchStreamUrl]);

  // Heartbeat + abandon beacon
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(() => {
      navigator.sendBeacon(
        `${BACKEND_URL}/api/sessions/${sessionId}/heartbeat`
      );
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
  }, [sessionId]);

  const handleAdClick = async () => {
    if (ad) {
      try {
        await axios.post(`${BACKEND_URL}/api/ads/click/${ad._id}`);
      } catch (err) {
        console.error("Failed to track ad click:", err);
      }
      window.open(ad.redirectUrl, "_blank");
    }
  };

  const handleLaunch = () => {
    if (streamUrl) {
      window.location.href = streamUrl;
    }
  };

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

  return (
    <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col font-sans overflow-hidden select-none">

      {/* TOP BAR: SPONSOR INFO */}
      <div className="absolute top-0 left-0 right-0 p-6 z-20">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div
            className="flex items-center space-x-3 bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-gray-800 p-2 pr-4 rounded-xl cursor-pointer shadow-sm group"
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

      {/* MAIN AD CONTENT */}
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

      {/* BOTTOM CONTROL AREA */}
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

          {/* ACTION BUTTON */}
          <div className="flex flex-col items-end gap-2">
            {canSkip ? (
              <>
                <button
                  onClick={handleLaunch}
                  disabled={!streamUrl}
                  className="group flex items-center space-x-3 bg-gray-800 dark:bg-gray-200
                    text-white dark:text-black px-8 py-3 rounded-xl text-sm font-bold
                    transition-all shadow-lg hover:scale-[1.02] active:scale-95
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* ✅ Clear loading state while URL is being fetched */}
                  {streamUrl ? (
                    <>
                      <span>LAUNCH SESSION</span>
                      <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </>
                  ) : streamUrlError ? (
                    <span>RETRY</span>
                  ) : (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>CONNECTING...</span>
                    </>
                  )}
                </button>
                {/* ✅ Retry button if URL fetch failed */}
                {streamUrlError && (
                  <button
                    onClick={() => {
                      setStreamUrlError(false);
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
          </div>

        </div>
      </div>
    </div>
  );
}