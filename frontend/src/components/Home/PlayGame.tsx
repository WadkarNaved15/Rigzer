import { useEffect, useState } from "react";
import axios from "axios";

const stepsMap = {
  starting_server: "Initializing",
  initializing_game: "Loading Server",
  initializing_stream: "Initializing Stream",
  setting_up_input: "Setting Up Input Server",
  ready: "Ready",
};

// Keep steps in order
const orderedSteps = [
  "starting_server",
  "initializing_game",
  "initializing_stream",
  "setting_up_input",
  "ready",
];

export default function AdWithStatus({ onComplete }) {
  const [sessionId, setSessionId] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showSkip, setShowSkip] = useState(false);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Start game session on mount
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

  // Poll backend for status
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/game/status/${sessionId}`);
        const stepKey = res.data.step;

        const stepIndex = orderedSteps.indexOf(stepKey);
        if (stepIndex !== -1) {
          setCurrentStepIndex(stepIndex);
        }

        // When backend says ready → show skip button
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

  return (
    <div className="fixed inset-0 bg-black z-50 flex justify-center items-center">

      {/* VIDEO AD */}
      <video
        autoPlay
        muted
        loop
        className="w-full h-full object-cover"
        src="/video-ad.mp4"
      />

      {/* TOP-RIGHT STATUS LIST */}
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

      {/* SKIP BUTTON (shown when backend is ready) */}
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
