import React, { useState, useEffect } from 'react';
import { Play, X, Zap } from 'lucide-react';

interface InstanceReadyModalProps {
  sessionId: string | null;
  countdown: number;  // seconds remaining (30 to 0)
  onLaunch: () => Promise<void>;
  onCancel: () => Promise<void>;
  isVisible: boolean;
}

/**
 * InstanceReadyModal Component
 * ✅ ONLY shown for QUEUED users when instance becomes available
 * ✅ 30-second countdown modal
 * ✅ Two options: LAUNCH STREAM or CANCEL
 * ✅ If countdown expires, auto-cancel
 * ✅ Forces decision (modal backdrop, not dismissible)
 * ✅ RESPONSIVE: Works on mobile, tablet, and desktop
 */
export const InstanceReadyModal: React.FC<InstanceReadyModalProps> = ({
  sessionId,
  countdown,
  onLaunch,
  onCancel,
  isVisible,
}) => {
  const [isLaunching, setIsLaunching] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [displayCountdown, setDisplayCountdown] = useState(countdown);

  useEffect(() => {
    setDisplayCountdown(countdown);

    const interval = setInterval(() => {
      setDisplayCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onCancel(); // auto release instance
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown, onCancel]);

  const handleLaunch = async () => {
    setIsLaunching(true);
    try {
      await onLaunch();
    } catch (err) {
      console.error("Launch failed:", err);
      setIsLaunching(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancel();
    } catch (err) {
      console.error("Cancel failed:", err);
      setIsCancelling(false);
    }
  };

  if (!isVisible || !sessionId) return null;

  // Color coding for countdown urgency
  const getCountdownColor = () => {
    if (displayCountdown > 15) return 'text-green-600 dark:text-green-400';
    if (displayCountdown > 5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getCountdownMessage = () => {
    if (displayCountdown > 15) return '🚀 Get ready to stream...';
    if (displayCountdown > 5) return '⚡ Almost there...';
    return '💨 Hurry up!';
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Modal Container - Responsive and scrollable if needed */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
        <div className="w-full max-w-md rounded-3xl border border-gray-300 dark:border-gray-700/50 bg-gradient-to-br from-gray-100 via-gray-50 to-white dark:from-black dark:via-slate-900 dark:to-black shadow-2xl overflow-hidden my-auto">

          {/* Header - Responsive padding and text */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 text-center border-b border-gray-200/50 dark:border-gray-700/30 bg-gradient-to-r from-gray-200/50 to-gray-100/50 dark:from-gray-900/50 dark:to-black/50">
            <div className="flex items-center justify-center gap-2 mb-2 sm:mb-3">
              <div className="relative h-3 w-3 bg-green-500 rounded-full">
                <div className="absolute inset-0 bg-green-500 rounded-full animate-pulse" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 tracking-wide uppercase">
                🎉 Instance Ready
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-tight">
              Your Game<br />is Ready!
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
              ✨ An instance has been allocated for you
            </p>
          </div>

          {/* Countdown Section - Responsive spacing and sizes */}
          <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                Launching in
              </p>

              {/* Circular Countdown - Responsive size */}
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
                {/* SVG Progress Circle */}
                <svg className="absolute w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Background circle */}
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${(displayCountdown / 30) * (2 * Math.PI * 70)} ${2 * Math.PI * 70}`}
                    className={`transition-all duration-1000 ${getCountdownColor()}`}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Center Number - Responsive sizing */}
                <div className="relative text-center">
                  <div className={`text-4xl sm:text-5xl font-black tabular-nums ${getCountdownColor()}`}>
                    {displayCountdown.toString().padStart(2, '0')}
                  </div>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">
                    Seconds
                  </div>
                </div>
              </div>

              {/* Message */}
              <p className="text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                {getCountdownMessage()}
              </p>
            </div>

            {/* Info Box - Responsive padding and text */}
            <div className="p-2 sm:p-3 bg-gray-100 dark:bg-gray-800/20 border border-gray-200 dark:border-gray-700 rounded-lg">
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                📌 If you don't click "Launch" within {displayCountdown}s, the instance will be released to the next user.
              </p>
            </div>
          </div>

          {/* Action Buttons - Responsive padding and sizing */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-black dark:to-gray-900 border-t border-gray-200 dark:border-gray-700 space-y-2 sm:space-y-3">
            {/* Launch Button - Primary */}
            <button
              onClick={handleLaunch}
              disabled={isLaunching || displayCountdown === 0}
              className="
                w-full
                bg-gradient-to-br
                from-gray-600 to-gray-800
                hover:from-gray-700 hover:to-gray-900
                
                dark:from-gray-700 dark:to-gray-900
                dark:hover:from-gray-800 dark:hover:to-black
                
                text-white
                py-3 sm:py-4 px-4 sm:px-6 rounded-xl
                transition-all duration-300 transform
                hover:scale-105 active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
                font-black text-base sm:text-lg
                shadow-lg shadow-gray-600/40
                flex items-center justify-center gap-2 sm:gap-3
              "
            >
              <Play size={20} className="sm:w-6 sm:h-6" fill="currentColor" />
              <span className="hidden xs:inline">LAUNCH STREAM</span>
              <span className="xs:hidden">LAUNCH</span>
            </button>

            {/* Cancel Button - Destructive Secondary */}
            <button
              onClick={handleCancel}
              disabled={isCancelling || isLaunching}
              className="
                w-full
                bg-gradient-to-br
                from-red-500 to-red-600
                hover:from-red-600 hover:to-red-700
                
                dark:from-red-600 dark:to-red-700
                dark:hover:from-red-700 dark:hover:to-red-800
                
                text-white
                py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl
                transition-all duration-300 transform
                hover:scale-105 active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
                font-semibold text-sm sm:text-base
                shadow-lg shadow-red-500/30
                flex items-center justify-center gap-1.5 sm:gap-2
              "
            >
              <X size={18} />
              <span className="hidden xs:inline">Cancel & Leave</span>
              <span className="xs:hidden">Cancel</span>
            </button>
          </div>

          {/* Footer Info - Responsive text size */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-200 dark:bg-gray-900/50 text-center border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-700 dark:text-gray-400">
              ⚡ Instance allocated • Ready to stream
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstanceReadyModal;