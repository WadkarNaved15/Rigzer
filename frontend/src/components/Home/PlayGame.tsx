import { useEffect, useState } from "react";
import axios from "axios";
type AdWithStatusProps = {
  onComplete?: () => void;
};

interface Ad {
  mediaType: string;
  mediaUrl: string;
  redirectUrl: string;
  logoUrl?: string;
  // add other properties as needed
}

const stepsMap: { [key: string]: string } = {
  starting_server: "Initializing",
  initializing_game: "Loading Server",
  initializing_stream: "Initializing Stream",
  setting_up_input: "Setting Up Input Server",
  ready: "Ready",
};

const orderedSteps = [
  "starting_server",
  "initializing_game",
  "initializing_stream",
  "setting_up_input",
  "ready",
];

export default function AdWithStatus({ onComplete = () => { } }: AdWithStatusProps) {
  const [sessionId, setSessionId] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showSkip, setShowSkip] = useState(false);

  const [ad, setAd] = useState<Ad | null>(null);

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
  // Enable real fullscreen on mount, exit on unmount
  useEffect(() => {
    const enterFullscreen = () => {
      const el = document.documentElement;

      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => { });
      }
    };

    // Try to enter fullscreen
    enterFullscreen();

    // Exit fullscreen when component unmounts
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
    };
  }, []);

  // Start game session
  useEffect(() => {
    const startSession = async () => {
      try {
        const res = await axios.post(`${BACKEND_URL}/api/game/start`);
        setSessionId(res.data.sessionId);
      } catch (err) {
        console.error("Failed to start session:", err);
      }
    };
    startSession();
  }, []);

  // Poll game status
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/game/status/${sessionId}`);
        const stepKey = res.data.step;

        const stepIndex = orderedSteps.indexOf(stepKey);
        if (stepIndex !== -1) setCurrentStepIndex(stepIndex);

        if (stepKey === "ready") {
          setShowSkip(true);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Status check failed:", err);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionId]);

  if (!ad) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex justify-center items-center text-white text-2xl">
        Loading Ad...
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
          className="w-full h-full object-cover"
          src={ad.mediaUrl}
          onClick={() => window.open(ad.redirectUrl, "_blank")}
        />
      ) : (
        <img
          src={ad.mediaUrl}
          className="w-full h-full object-cover cursor-pointer"
          onClick={() => window.open(ad.redirectUrl, "_blank")}
          alt="Ad"
        />
      )}

      {/* LOGO (Top-left corner) */}
      {/* {ad.logoUrl && ad.logoUrl !== "null" && (
        <img
          src={ad.logoUrl}
          alt="logo"
          className="absolute bottom-4 left-4 w-28 h-auto rounded-lg cursor-pointer"
          onClick={() => window.open(ad.redirectUrl, "_blank")}
        />
      )} */}

      {/* STATUS LIST */}
      <div className="absolute top-6 right-6 bg-black bg-opacity-40 p-4 rounded-xl 
                      text-white space-y-2 text-lg font-semibold select-none">

        {orderedSteps.map((step, index) => (
          <div key={index} className="flex items-center space-x-2">
            <span className={`${index <= currentStepIndex ? "opacity-100" : "opacity-40"}`}>
              {stepsMap[step]}
            </span>

            {index < currentStepIndex && <span className="text-green-400">✔</span>}
          </div>
        ))}
      </div>

      {/* SKIP BUTTON */}
      {showSkip && (
        <button
          onClick={onComplete}
          className="absolute bottom-6 right-6 bg-black bg-opacity-60 
                     text-white px-5 py-2 rounded-lg text-lg 
                     hover:bg-opacity-80 transition"
        >
          Skip Ad
        </button>
      )}
    </div>
  );
}
