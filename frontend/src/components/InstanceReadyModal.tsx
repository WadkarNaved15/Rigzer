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
  }, [countdown]);

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

      {/* Modal Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in zoom-in duration-300">
        <div className="w-full max-w-md rounded-3xl border border-sky-200 dark:border-sky-800/50 bg-gradient-to-br from-white via-sky-50 to-blue-50 dark:from-gray-900 dark:via-slate-900 dark:to-slate-950 shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="px-6 py-6 text-center border-b border-sky-200/50 dark:border-sky-800/30 bg-gradient-to-r from-sky-500/5 to-blue-500/5">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="relative h-3 w-3 bg-green-500 rounded-full">
                <div className="absolute inset-0 bg-green-500 rounded-full animate-pulse" />
              </div>
              <span className="text-sm font-bold text-gray-600 dark:text-gray-300 tracking-wide uppercase">
                🎉 Instance Ready
              </span>
            </div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">
              Your Game<br />is Ready!
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              ✨ An instance has been allocated for you
            </p>
          </div>

          {/* Countdown Section */}
          <div className="px-6 py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Launching in
              </p>

              {/* Circular Countdown */}
              <div className="relative w-40 h-40 flex items-center justify-center">
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

                {/* Center Number */}
                <div className="relative text-center">
                  <div className={`text-5xl font-black tabular-nums ${getCountdownColor()}`}>
                    {displayCountdown.toString().padStart(2, '0')}
                  </div>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">
                    Seconds
                  </div>
                </div>
              </div>

              {/* Message */}
              <p className="text-center text-sm text-gray-600 dark:text-gray-400 font-medium">
                {getCountdownMessage()}
              </p>
            </div>

            {/* Info Box */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                📌 If you don't click "Launch" within {displayCountdown}s, the instance will be released to the next user.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-6 py-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-t border-gray-200 dark:border-gray-700 space-y-3">
            {/* Launch Button - Primary */}
            <button
              onClick={handleLaunch}
              disabled={isLaunching || displayCountdown === 0}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl
                bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600
                text-white font-black text-lg
                shadow-lg shadow-sky-500/30 hover:shadow-xl
                transition-all hover:scale-105 active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            >
              <Play size={24} fill="currentColor" />
              {isLaunching ? 'LAUNCHING...' : 'LAUNCH STREAM'}
            </button>

            {/* Cancel Button - Secondary */}
            <button
              onClick={handleCancel}
              disabled={isCancelling || isLaunching}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl
                bg-red-500/10 hover:bg-red-500/20
                text-red-600 dark:text-red-400
                border border-red-300/30 dark:border-red-800/30
                font-semibold
                transition-all
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={18} />
              {isCancelling ? 'Cancelling...' : 'Cancel & Leave'}
            </button>
          </div>

          {/* Footer Info */}
          <div className="px-6 py-3 bg-gray-100 dark:bg-gray-800/50 text-center border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              ⚡ Instance allocated • Ready to stream
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstanceReadyModal;