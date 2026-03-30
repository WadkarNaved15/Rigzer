import { createPortal } from "react-dom";
import { useState } from "react";
import { useQueue } from "../context/QueueContext";
import QueueNotification from "./QueueNotification";
import InstanceReadyModal from "./InstanceReadyModal";
import AdWithStatus from "../components/Home/PlayGame";

export default function SessionOverlay() {
  const { queue, cancelSession, launchSession } = useQueue();
  const [isQueueMinimized, setIsQueueMinimized] = useState(false);

  if (!queue.sessionId) return null;

  const isQueued = queue.queuePosition !== null;

  const showQueueNotification =
    queue.status === "waiting" && isQueued;

  const showInstanceReady =
    queue.status === "allocation_ready" && !queue.isDirectPlay;

  const showAds =
    queue.sessionId &&
    queue.queuePosition === null &&
    ["waiting", "starting", "running"].includes(queue.status);

  return createPortal(
    <>
      {showQueueNotification && (
        <QueueNotification
            sessionId={queue.sessionId}
            queuePosition={queue.queuePosition}
            totalQueued={queue.totalQueued}
            estimatedWaitMinutes={queue.estimatedWaitMinutes}
            isVisible={true}
            isMinimized={isQueueMinimized}
            onMinimize={setIsQueueMinimized}
            onCancel={cancelSession}
            />
      )}

      {showInstanceReady && (
        <InstanceReadyModal
          sessionId={queue.sessionId}
          countdown={queue.countdownSecondsRemaining || 30}
          onLaunch={launchSession}
          onCancel={cancelSession}
          isVisible={true}
        />
      )}

      {showAds && (
        <AdWithStatus sessionId={queue.sessionId} />
      )}
    </>,
    document.body
  );
}