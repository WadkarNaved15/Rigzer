import React, { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

interface InstanceStartingNotificationProps {
  sessionId: string | null;
  isVisible: boolean;
  isMinimized: boolean;
  onMinimize: (val: boolean) => void;
  onCancel: () => Promise<void>;
}

export const InstanceStartingNotification: React.FC<
  InstanceStartingNotificationProps
> = ({ sessionId, isVisible, isMinimized, onMinimize, onCancel }) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));

    check();

    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  if (!isVisible || !sessionId) return null;

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancel();
    } catch (err) {
      console.error("Cancel error:", err);
      setIsCancelling(false);
    }
  };

  const gradient = isDark
    ? "linear-gradient(to bottom right, #3D7A6E, #000000)"
    : "linear-gradient(to bottom right, #9ca3af, #374151)";

  const bodyBg = isDark ? "#000000" : "#f3f4f6";
  const borderColor = isDark
    ? "rgba(255,255,255,0.07)"
    : "rgba(0,0,0,0.1)";

  if (isMinimized) {
    return (
      <div
        onClick={() => onMinimize(false)}
        className="fixed bottom-6 right-24 z-40 cursor-pointer group"
      >
        <div
          style={{ background: gradient }}
          className="text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3"
        >
          <Loader2 className="animate-spin" size={16} />
          <span className="font-bold text-sm">Starting Instance</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-24 z-40 w-96 max-w-[calc(100vw-32px)]">
      <div
        style={{ background: bodyBg, border: `1px solid ${borderColor}` }}
        className="rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div
          style={{ background: gradient }}
          className="text-white px-5 py-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Loader2 size={18} className="animate-spin" />

            <div>
              <h3 className="font-black text-base leading-tight">
                Preparing Your Game
              </h3>

              <p className="text-xs text-white/60">
                Instance assigned — starting environment
              </p>
            </div>
          </div>

          <button
            onClick={() => onMinimize(true)}
            className="
              bg-gradient-to-br
              from-gray-400 to-gray-600
              hover:from-gray-500 hover:to-gray-700
              dark:from-gray-600 dark:to-gray-800
              dark:hover:from-gray-700 dark:hover:to-gray-900
              text-white
              p-2 rounded-lg
              transition-all duration-300 transform
              hover:scale-110
              active:scale-95
            "
          >
            <ChevronDown size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            className="flex items-center gap-3 p-3 rounded-xl"
          >
            <Loader2 size={18} className="animate-spin text-white" />

            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                Status
              </p>

              <p className="text-base font-bold text-white">
                Starting game environment
              </p>
            </div>
          </div>

          <p className="text-xs text-white/30 text-center italic">
            This usually takes 20–40 seconds. We'll launch the stream
            automatically when ready.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="
              flex-1
              bg-gradient-to-br
              from-red-500 to-red-600
              hover:from-red-600 hover:to-red-700
              dark:from-red-600 dark:to-red-700
              dark:hover:from-red-700 dark:hover:to-red-800
              text-white
              py-2.5 rounded-xl
              transition-all duration-300 transform
              hover:scale-105
              active:scale-95
              disabled:opacity-50
              font-bold text-sm
              shadow-lg shadow-red-500/30
            "
          >
            {isCancelling ? "Cancelling..." : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstanceStartingNotification;