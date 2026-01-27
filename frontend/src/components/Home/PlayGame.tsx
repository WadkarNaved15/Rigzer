import { useEffect, useState } from "react";
import axios from "axios";

type AdWithStatusProps = {
  sessionId: string;
  onStreamReady?: (sessionId: string) => void;
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
  starting: "Initializing Session",
  downloading: "Downloading Game",
  launching: "Launching Game",
  running: "Stream Ready",
};

const orderedSteps = [
  "starting",
  "downloading",
  "launching",
  "running",
];

export default function AdWithStatus({ sessionId, onStreamReady }: AdWithStatusProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<string>("starting");
  const [ad, setAd] = useState<Ad | null>(null);
  const [canSkip, setCanSkip] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Fetch ad on mount
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

  // Enable fullscreen on mount
  useEffect(() => {
    const enterFullscreen = () => {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      }
    };

    enterFullscreen();

    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

useEffect(() => {
  if (!sessionId) return;

 const es = new EventSource(
  `${BACKEND_URL}/api/sessions/${sessionId}/events`,
  { withCredentials: true }
);
  es.onmessage = (e) => {
    const { status, phase } = JSON.parse(e.data);

    const effectiveStatus =
      status === "running" || status === "ended" || status === "failed"
        ? status
        : phase ?? status;

    setSessionStatus(effectiveStatus);

    if (effectiveStatus === "starting") setCurrentStepIndex(0);
    if (effectiveStatus === "downloading") setCurrentStepIndex(1);
    if (effectiveStatus === "launching") setCurrentStepIndex(2);

    if (effectiveStatus === "running") {
      setCurrentStepIndex(3);
      setCanSkip(true);
      setTimeout(() => onStreamReady?.(sessionId), 1500);
    }

    if (status === "failed") {
      alert("Failed to start game session.");
      es.close();
    }

    if (status === "ended") {
      alert("Session ended.");
      es.close();
    }
  };

  es.onerror = () => {
    es.close(); // browser auto-retries
  };

  return () => es.close();
}, [sessionId]);


  const handleSkip = () => {
    if (canSkip) {
      onStreamReady?.(sessionId);
    }
  };

  const handleAdClick = async () => {
    if (ad) {
      // Track click
      try {
        await axios.post(`${BACKEND_URL}/api/ads/click/${ad._id}`);
      } catch (err) {
        console.error("Failed to track ad click:", err);
      }
      window.open(ad.redirectUrl, "_blank");
    }
  };

  if (!ad) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex justify-center items-center text-white text-2xl">
        Loading...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex justify-center items-center">
      {/* MEDIA (Video or Image) */}
      {ad.mediaType === "video" ? (
        <video
          autoPlay
          muted
          loop
          className="w-full h-full object-cover cursor-pointer"
          src={ad.mediaUrl}
          onClick={handleAdClick}
        />
      ) : (
        <img
          src={ad.mediaUrl}
          className="w-full h-full object-cover cursor-pointer"
          onClick={handleAdClick}
          alt="Advertisement"
        />
      )}

      {/* STATUS LIST */}
      <div className="absolute top-6 right-6 bg-black bg-opacity-60 p-4 rounded-xl 
                      text-white space-y-2 text-sm font-semibold select-none backdrop-blur-sm">
        {orderedSteps.map((step, index) => (
          <div key={index} className="flex items-center space-x-2">
            <span className={`${index <= currentStepIndex ? "opacity-100" : "opacity-40"}`}>
              {stepsMap[step]}
            </span>
            {index < currentStepIndex && <span className="text-green-400">✔</span>}
            {index === currentStepIndex && sessionStatus !== "running" && (
              <span className="text-yellow-400 animate-pulse">●</span>
            )}
          </div>
        ))}
      </div>

      {/* SKIP BUTTON */}
      {canSkip && (
        <button
          onClick={handleSkip}
          className="absolute bottom-6 right-6 bg-sky-500 hover:bg-sky-600
                     text-white px-6 py-3 rounded-lg text-lg font-bold
                     transition-all shadow-lg hover:scale-105 active:scale-95"
        >
          Start Playing →
        </button>
      )}

      {/* AD SPONSOR INFO (optional) */}
      {ad.logoUrl && ad.logoUrl !== "null" && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-2 rounded-lg backdrop-blur-sm">
          <img
            src={ad.logoUrl}
            alt="Sponsor"
            className="h-8 w-auto cursor-pointer"
            onClick={handleAdClick}
          />
        </div>
      )}
    </div>
  );
}