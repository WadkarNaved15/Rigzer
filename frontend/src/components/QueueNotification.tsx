import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Users } from 'lucide-react';

interface QueueNotificationProps {
  sessionId: string | null;
  queuePosition: number | null;
  totalQueued: number | null;
  estimatedWaitMinutes: number | null;
  isVisible: boolean;
  isMinimized: boolean;              
  onMinimize: (val: boolean) => void; 
  onCancel: () => Promise<void>;
}

export const QueueNotification: React.FC<QueueNotificationProps> = ({
  sessionId,
  queuePosition,
  totalQueued,
  estimatedWaitMinutes,
  isVisible,
  isMinimized,
  onMinimize,
  onCancel,
}) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (!isVisible || !sessionId) return null;

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancel();
    } catch (err) {
      console.error('Cancel error:', err);
      setIsCancelling(false);
    }
  };

  // Gradient — light: gray-400 → gray-800 | dark: black → teal
  const gradient = isDark
    ? 'linear-gradient(to bottom right, #3D7A6E, #000000)'
    : 'linear-gradient(to bottom right, #9ca3af, #374151)';

  // Body bg — echoes the gradient endpoint so header flows into body seamlessly
  const bodyBg = isDark ? '#000000' : '#f3f4f6';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)';

  // ✅ MINIMIZED — badge only
  if (isMinimized) {
    return (
      <div
        onClick={() => onMinimize(false)}
        className="fixed bottom-6 right-24 z-40 cursor-pointer group"
      >
        <div className="relative">
          <div
            style={{ background: gradient }}
            className="text-white px-4 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-3"
          >
            <Users size={16} />
            <span className="font-bold text-sm">Queue #{queuePosition}</span>
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </div>
            <ChevronUp size={16} className="opacity-70" />
          </div>
          <div className="absolute bottom-full mb-2 right-0 bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Click to expand
          </div>
        </div>
      </div>
    );
  }

  // ✅ EXPANDED — unified dark card, header and body share the same dark palette
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
            <div className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-white/30" />
            </div>
            <div>
              <h3 className="font-black text-base leading-tight">You're in Queue</h3>
              <p className="text-xs text-white/60">Waiting for available instance</p>
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
              group relative
            "
            aria-label="Minimize"
          >
            <ChevronDown size={20} className="group-hover:animate-pulse text-white" />
          </button>
        </div>

        {/* Body — dark, consistent with header tone */}
        <div className="px-5 py-4 space-y-3">

          {/* Queue position row */}
          <div
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            className="flex items-center justify-between p-3 rounded-xl"
          >
            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">
                Queue Position
              </p>
              <p className="text-3xl font-black text-white dark:text-white leading-none">
                #{queuePosition}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">
                Total in Queue
              </p>
              <div className="flex items-center justify-end gap-1.5">
                <Users size={14} className="text-white/30" />
                <p className="text-2xl font-bold text-white dark:text-[#C2C2C2] leading-none">
                  {totalQueued}
                </p>
              </div>
            </div>
          </div>

          {/* Estimated wait */}
          {estimatedWaitMinutes !== null && (
            <div
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              className="flex items-center gap-3 p-3 rounded-xl"
            >
              <Clock size={18} className="text-white flex-shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">
                  Estimated Wait
                </p>
                <p className="text-base font-bold text-white">
                  {estimatedWaitMinutes < 1
                    ? '< 1 minute'
                    : `${estimatedWaitMinutes} minute${estimatedWaitMinutes !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-white/30 text-center italic">
            You can browse while waiting — we'll notify you when it's your turn.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          {/* Cancel Button - Destructive */}
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
              disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
              font-bold text-sm
              shadow-lg shadow-red-500/30
            "
          >
            {isCancelling ? 'Cancelling...' : 'Cancel Queue'}
          </button>
          
          {/* Minimize Button - Secondary */}
          <button
            onClick={() => onMinimize(true)}
            className="
              flex-1
              bg-gradient-to-br
              from-gray-600 to-gray-700
              hover:from-gray-700 hover:to-gray-800
              
              dark:from-gray-700 dark:to-gray-800
              dark:hover:from-gray-800 dark:hover:to-gray-900
              
              text-white
              py-2.5 rounded-xl
              transition-all duration-300 transform
              hover:scale-105
              active:scale-95
              font-bold text-sm
              shadow-lg shadow-gray-500/30
            "
          >
            Minimize
          </button>
        </div>
      </div>
    </div>
  );
};

export default QueueNotification;