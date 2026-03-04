import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, ChevronRight } from "lucide-react";

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
}

const orderedSteps = ["starting", "downloading", "launching", "running"];

export default function AdWithStatus({ sessionId, onStreamReady }: AdWithStatusProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<string>("starting");
  const [ad, setAd] = useState<Ad | null>(null);
  const [canSkip, setCanSkip] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

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

  // EventSource for session updates
  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(`${BACKEND_URL}/api/sessions/${sessionId}/events`, {
      withCredentials: true,
    });

    es.onmessage = (e) => {
      const { status, phase } = JSON.parse(e.data);
      const effectiveStatus = ["running", "ended", "failed"].includes(status)
        ? status
        : phase ?? status;

      setSessionStatus(effectiveStatus);

      const stepIdx = orderedSteps.indexOf(effectiveStatus);
      if (stepIdx !== -1) setCurrentStepIndex(stepIdx);

      if (effectiveStatus === "running") {
        setCanSkip(true);
        // Note: Auto-navigation removed as requested. User must click button.
      }
      
      if (status === "failed" || status === "ended") es.close();
    };

    return () => es.close();
  }, [sessionId]);

  const handleAdClick = async () => {
    if (ad) {
      try {
        await axios.post(`${BACKEND_URL}/api/ads/click/${ad._id}`);
      } catch (err) { /* silent */ }
      window.open(ad.redirectUrl, "_blank");
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
    <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col font-sans overflow-hidden select-none transition-colors duration-300">
      
      {/* TOP BAR: SPONSOR INFO (Light/Dark Glassmorphism) */}
      <div className="absolute top-0 left-0 right-0 p-6 z-20">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div 
            className="flex items-center space-x-3 bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-gray-800 p-2 pr-4 rounded-xl cursor-pointer shadow-sm group"
            onClick={handleAdClick}
          >
            {ad.logoUrl && (
              <img src={ad.logoUrl} alt="Sponsor" className="h-7 w-auto object-contain" />
            )}
            <div className="flex flex-col border-l border-gray-200 dark:border-gray-700 pl-3">
              <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] leading-none mb-1 font-bold">Sponsored</span>
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
            alt="Ad" 
          />
        )}
      </div>

      {/* BOTTOM CONTROL AREA (Light/Dark Gradient) */}
      <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white dark:from-black to-transparent">
        <div className="max-w-7xl mx-auto flex items-end justify-between">
          
          {/* MINIMAL PROGRESS STEPS (Grayscale Style) */}
          <div className="flex flex-col space-y-3 w-64 bg-white/50 dark:bg-black/20 backdrop-blur-sm p-4 rounded-xl border border-gray-200/50 dark:border-gray-800/50">
             <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                <span className="text-gray-400 dark:text-gray-500">System Status</span>
                <span className="text-gray-600 dark:text-gray-300">{sessionStatus.replace('_', ' ')}</span>
             </div>
             <div className="flex space-x-1.5 h-[3px] w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                {orderedSteps.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-full flex-grow transition-all duration-700 ${
                      idx <= currentStepIndex 
                        ? 'bg-gray-600 dark:bg-gray-300' 
                        : 'bg-transparent'
                    } ${idx === currentStepIndex && sessionStatus !== 'running' ? 'animate-pulse' : ''}`}
                  />
                ))}
             </div>
          </div>

          {/* ACTION BUTTON (Solid Messaging Style) */}
          <div className="flex flex-col items-end">
            {canSkip ? (
              <button
                onClick={() => onStreamReady?.(sessionId)}
                className="group flex items-center space-x-3 bg-gray-800 dark:bg-gray-200 text-white dark:text-black px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-95 border border-transparent dark:hover:bg-white"
              >
                <span>LAUNCH SESSION</span>
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
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