import GameSession from "../models/GameSession.js";
import { callController } from "./controllerService.js";
import { publishSessionEvent } from "./sessionPubSub.js";
import { sessionStreams } from "./sessionStream.js";

const COUNTDOWN_SECONDS = 30;
const COUNTDOWN_DELAY_MS = 5000;

/**
 * Finalizes a session only after BOTH:
 *
 *   1. GPU has been leased
 *   2. Session EBS volume is ready
 *
 * This function can safely be called by both:
 *
 *   - GPU-ready path
 *   - Storage-ready path
 *
 * MongoDB's atomic status transition prevents
 * the controller from being started twice.
 */
export async function tryFinalizeSessionAllocation(sessionId) {
  const session = await GameSession.findById(sessionId);

  if (!session) {
    console.warn(`[AllocationCoordinator] Session not found: ${sessionId}`);
    return null;
  }

  /*
   * Only waiting sessions can be finalized here.
   */
  if (session.status !== "waiting") {
    return session;
  }

  /*
   * GPU must already be assigned.
   */
  if (!session.instanceId || !session.leaseToken) {
    return session;
  }

  /*
   * Session-specific EBS volume must be ready.
   */
  if (session.storage?.status !== "ready") {
    return session;
  }

  /*
   * ==========================================================
   * QUEUED SESSION
   *
   * GPU + EBS ready
   *       ↓
   * allocation_ready
   *       ↓
   * countdown
   *       ↓
   * user clicks Launch
   * ==========================================================
   */
  if (session.queueType === "queued") {
    const now = new Date();
    const countdownStartsAt = new Date(now.getTime() + COUNTDOWN_DELAY_MS);
    const allocationExpiresAt = new Date(countdownStartsAt.getTime() + (COUNTDOWN_SECONDS * 1000));

    const updated = await GameSession.findOneAndUpdate(
      {
        _id: sessionId,
        status: "waiting",
        queueType: "queued",
        instanceId: { $ne: null },
        leaseToken: { $ne: null },
        "storage.status": "ready",
      },
      {
        $set: {
          status: "allocation_ready",
          phase: "countdown",
          countdownStartsAt,
          countdownSeconds: COUNTDOWN_SECONDS,
          allocationExpiresAt,
          expiresAt: new Date(now.getTime() + (session.maxDurationSeconds * 1000)),
        },
      },
      { new: true }
    );

    /*
     * Another process won the race.
     */
    if (!updated) {
      return GameSession.findById(sessionId);
    }

    /*
     * Notify SSE.
     */
    const send = sessionStreams.get(sessionId.toString());

    if (send) {
      send({
        status: "allocation_ready",
        phase: "countdown",
        countdownStartsAt,
        countdownSeconds: COUNTDOWN_SECONDS,
        allocationExpiresAt,
      });
    }

    /*
     * Notify other backend consumers.
     */
    try {
      await publishSessionEvent(sessionId, {
        status: "allocation_ready",
        phase: "countdown",
      });
    } catch (error) {
      console.warn("[AllocationCoordinator] PubSub failed:", error.message);
    }

    console.log(
      `[AllocationCoordinator] Queue allocation ready session=${sessionId} ` +
      `instance=${updated.instanceId} volume=${updated.storage?.volumeId}`
    );

    return updated;
  }

  /*
   * ==========================================================
   * DIRECT SESSION
   *
   * GPU + EBS ready
   *       ↓
   * starting
   *       ↓
   * controller
   * ==========================================================
   */
  const updated = await GameSession.findOneAndUpdate(
    {
      _id: sessionId,
      status: "waiting",
      queueType: "direct",
      instanceId: { $ne: null },
      leaseToken: { $ne: null },
      "storage.status": "ready",
    },
    {
      $set: {
        status: "starting",
        phase: "downloading",
      },
    },
    { new: true }
  );

  /*
   * Another process already finalized this session.
   *
   * This is what protects us when both:
   *
   *   storage-ready
   *
   * and
   *
   *   instance-ready
   *
   * call this function at nearly the same time.
   */
  if (!updated) {
    return GameSession.findById(sessionId);
  }

  /*
   * Notify frontend.
   */
  const send = sessionStreams.get(sessionId.toString());

  if (send) {
    send({
      status: "starting",
      phase: "downloading",
    });
  }

  try {
    await publishSessionEvent(sessionId, {
      status: "starting",
      phase: "downloading",
    });
  } catch (error) {
    console.warn("[AllocationCoordinator] PubSub failed:", error.message);
  }

  /*
   * At this point:
   *
   * GPU      = leased
   * instance = associated
   * EBS      = attached + ready
   *
   * Therefore the controller can safely start.
   */
  await callController(updated, {
    id: updated.instanceId,
    ip: updated.instanceIp,
    leaseToken: updated.leaseToken,
  });

  console.log(`[AllocationCoordinator] Controller started session=${sessionId}`);

  return updated;
}