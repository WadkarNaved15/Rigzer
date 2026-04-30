import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface QueueState {
  // Session
  sessionId: string | null;
  
  // Status
  status: 'waiting' | 'allocation_ready' | 'starting' | 'running' | 'ended' | 'failed';
  phase: 'countdown' | 'downloading' | 'launching' | null;
  
  // Queue Info
  queuePosition: number | null;
  totalQueued: number | null;
  estimatedWaitMinutes: number | null;
  
  // Ready Modal (ONLY for queued users)
  countdownStartsAt: Date | null;
  countdownSecondsRemaining: number | null;
  isDirectPlay: boolean;
  
  // Error
  errorMessage: string | null;
}

interface QueueContextType {
  queue: QueueState;
  startSession: (gamePostId: string) => Promise<string | null>;
  cancelSession: () => Promise<void>;
  launchSession: () => Promise<void>;
  dismissError: () => void;
  clearSession: () => void;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const STORAGE_KEY = 'rigzer_queue_session';

export const QueueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<QueueState>({
    sessionId: null,
    status: 'ended',
    phase: null,
    queuePosition: null,
    totalQueued: null,
    estimatedWaitMinutes: null,
    countdownStartsAt: null,
    countdownSecondsRemaining: null,
    isDirectPlay: false,
    errorMessage: null,
  });

  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);


  // ✅ Load session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        console.log('[Queue] Restored session from localStorage:', data.sessionId);
        
        // ✅ Restore queue state
        setQueue((prev) => ({
          ...prev,
          sessionId: data.sessionId,
          status: data.status,
          queuePosition: data.queuePosition,
          totalQueued: data.totalQueued,
          estimatedWaitMinutes: data.estimatedWaitMinutes,
        }));

        // ✅ If session exists, reconnect to SSE
        if (data.sessionId && ['waiting', 'allocation_ready', 'starting'].includes(data.status)) {
          console.log('[Queue] Reconnecting to SSE for session:', data.sessionId);
          setTimeout(() => setupSSE(data.sessionId), 500);
        }
      } catch (err) {
        console.error('[Queue] Failed to restore session:', err);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // ✅ Save session to localStorage whenever it changes
  useEffect(() => {
    if (queue.sessionId && queue.status !== 'ended' && queue.status !== 'failed') {
      const toSave = {
        sessionId: queue.sessionId,
        status: queue.status,
        queuePosition: queue.queuePosition,
        totalQueued: queue.totalQueued,
        estimatedWaitMinutes: queue.estimatedWaitMinutes,
        isDirectPlay: queue.isDirectPlay,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      console.log('[Queue] Saved session to localStorage:', toSave);
    } else if (queue.status === 'ended' || queue.status === 'failed') {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[Queue] Cleared session from localStorage');
    }
  }, [queue]);

      // 🧹 Clear Session
const clearSession = useCallback(() => {
  console.log("[Queue] Clearing session state");

  if (eventSource) eventSource.close();
  if (countdownInterval) clearInterval(countdownInterval);

  setQueue({
    sessionId: null,
    status: "ended",
    phase: null,
    queuePosition: null,
    totalQueued: null,
    estimatedWaitMinutes: null,
    countdownStartsAt: null,
    countdownSecondsRemaining: null,
    isDirectPlay: false,
    errorMessage: null,
  });

  localStorage.removeItem(STORAGE_KEY);
}, [eventSource, countdownInterval]);

// 🔌 Setup SSE Connection
const setupSSE = useCallback((sessionId: string) => {
  console.log('[Queue SSE] Setting up for session', sessionId);

  if (eventSource) eventSource.close();

  const es = new EventSource(
    `${BACKEND_URL}/api/sessions/${sessionId}/events`,
    { withCredentials: true }
  );

  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    console.log('[Queue SSE] Received:', data);

    // 🔴 Session finished → clear everything
    if (data.status === "ended" || data.status === "failed") {
      console.log("[Queue SSE] Session finished, clearing session");
      clearSession();
      return;
    }

    setQueue((prev) => {
      const newState = { ...prev };

      // Update status + phase
      if (data.status) newState.status = data.status;
      if (data.phase !== undefined) newState.phase = data.phase;

      // Update queue info
      if (data.queuePosition !== undefined)
        newState.queuePosition = data.queuePosition;

      if (data.totalQueued !== undefined)
        newState.totalQueued = data.totalQueued;

      if (data.estimatedWaitMinutes !== undefined)
        newState.estimatedWaitMinutes = data.estimatedWaitMinutes;

      // 🟡 QUEUED USER → show countdown modal
if (data.status === "allocation_ready") {
  console.log("[Queue SSE] allocation_ready → queued user");

  newState.isDirectPlay = false;

  const seconds = data.countdownSeconds || 30;

  newState.countdownStartsAt = data.countdownStartsAt
    ? new Date(data.countdownStartsAt)
    : new Date();

  newState.countdownSecondsRemaining = seconds;

  // start countdown timer
  if (countdownInterval) clearInterval(countdownInterval);

  const interval = setInterval(() => {
    setQueue(prev => {
      if (!prev.countdownSecondsRemaining) return prev;

      const next = prev.countdownSecondsRemaining - 1;

      if (next <= 0) {
        clearInterval(interval);
        cancelSession(); // auto release
        return { ...prev, countdownSecondsRemaining: 0 };
      }

      return {
        ...prev,
        countdownSecondsRemaining: next
      };
    });
  }, 1000);

  setCountdownInterval(interval);
}

      // 🟢 DIRECT USER → skip countdown, show ads
      if (data.status === "starting") {
        console.log("[Queue SSE] starting → direct session");

        if (countdownInterval) {
  clearInterval(countdownInterval);
  setCountdownInterval(null);
}

        newState.isDirectPlay = true;

        // IMPORTANT: reset countdown state
        newState.countdownStartsAt = null;
        newState.countdownSecondsRemaining = null;

        newState.phase = data.phase || "downloading";
      }

      return newState;
    });
  };

  es.onerror = () => {
    console.warn("[Queue SSE] Connection lost, retrying...");
    setTimeout(() => setupSSE(sessionId), 3000);
  };

  setEventSource(es);
}, [eventSource, clearSession]);

  // 🎮 Start Session
  const startSession = useCallback(
    async (gamePostId: string): Promise<string | null> => {
      try {
        // ✅ Prevent starting if session already exists
        if (queue.sessionId) {
          console.warn('[Queue] Session already exists, cannot start new one');
          return null;
        }

        console.log('[Queue] Starting session for game', gamePostId);

        setQueue((prev) => ({
          ...prev,
          status: 'waiting',
          isDirectPlay: false,
          errorMessage: null,
        }));

        const res = await fetch(`${BACKEND_URL}/api/sessions/start`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gamePostId }),
        });

        const data = await res.json();

        if (res.ok || res.status === 202) {
          const sessionId = data.sessionId;
          console.log('[Queue] Got sessionId:', sessionId);
          console.log('[Queue] Queue info from 202:', {
            queuePosition: data.queuePosition,
            totalQueued: data.totalQueued,
            estimatedWaitMinutes: data.estimatedWaitMinutes,
          });

          // ✅ Update queue state with all data from 202 response
          setQueue((prev) => ({
            ...prev,
            sessionId,
            status: 'waiting',
            queuePosition: data.queuePosition || null,
            totalQueued: data.totalQueued || null,
            estimatedWaitMinutes: data.estimatedWaitMinutes || null,
          }));

          // Start SSE listener
          setupSSE(sessionId);
          return sessionId;
        } else {
          console.error('[Queue] Start failed:', data);
          setQueue((prev) => ({
            ...prev,
            errorMessage: data.error || 'Failed to start session',
            status: 'failed',
          }));
          return null;
        }
      } catch (err: any) {
        console.error('[Queue] Network error:', err);
        setQueue((prev) => ({
          ...prev,
          errorMessage: err.message || 'Network error',
          status: 'failed',
        }));
        return null;
      }
    },
    [queue.sessionId, setupSSE]
  );

  // ❌ Cancel Session
  const cancelSession = useCallback(async () => {
    if (!queue.sessionId) return;

    try {
      console.log('[Queue] Cancelling session', queue.sessionId);
      const res = await fetch(`${BACKEND_URL}/api/sessions/${queue.sessionId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        clearSession();
      } else {
        console.error('[Queue] Cancel failed');
      }
    } catch (err) {
      console.error('[Queue] Cancel error:', err);
    }
  }, [queue.sessionId]);

  // 🚀 Launch Session (from countdown modal - ONLY for queued users)
  const launchSession = useCallback(async () => {
    if (!queue.sessionId) return;

    try {
      console.log('[Queue] Launching session', queue.sessionId);

      const res = await fetch(`${BACKEND_URL}/api/internal/session/launch`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: queue.sessionId }),
      });

      if (res.ok) {
        console.log('[Queue] Launch triggered');
        setQueue((prev) => ({
          ...prev,
          status: 'starting',
        }));
      } else {
        const data = await res.json();
        console.error('[Queue] Launch failed:', data);
        setQueue((prev) => ({
          ...prev,
          errorMessage: data.error || 'Failed to launch',
        }));
      }
    } catch (err) {
      console.error('[Queue] Launch error:', err);
    }
  }, [queue.sessionId]);



  // 📌 Dismiss Error
  const dismissError = useCallback(() => {
    setQueue((prev) => ({
      ...prev,
      errorMessage: null,
    }));
  }, []);

  // ❤️ Heartbeat every 10s
  useEffect(() => {
    if (!queue.sessionId) return;

    const interval = setInterval(() => {
      navigator.sendBeacon(
        `${BACKEND_URL}/api/sessions/${queue.sessionId}/heartbeat`
      );
    }, 10_000);

    return () => clearInterval(interval);
  }, [queue.sessionId]);

  // 🏃 Abandon Beacon on unload
  useEffect(() => {
    if (!queue.sessionId) return;

    const handleUnload = () => {
      navigator.sendBeacon(
        `${BACKEND_URL}/api/sessions/${queue.sessionId}/abandon/${import.meta.env.VITE_ABANDON_SECRET}`,
        new Blob([JSON.stringify({})], { type: 'application/json' })
      );
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [queue.sessionId]);

  const value: QueueContextType = {
    queue,
    startSession,
    cancelSession,
    launchSession,
    dismissError,
    clearSession,
  };

  return (
    <QueueContext.Provider value={value}>
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within QueueProvider');
  }
  return context;
};