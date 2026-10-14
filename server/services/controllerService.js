import fetch from "node-fetch";
import GameSession from "../models/GameSession.js";
import AllPost from "../models/Allposts.js";
import { cleanupSessionStorageInBackground } from "./sessionStorage.js";

export async function callController(session, lease) {
  try {
    const post = await AllPost.findById(session.gamePost).select("gamePost").lean();

    if (!post) {
      throw new Error("Game post not found");
    }

    const game = post.gamePost;
    const buildId = post._id.toString();
    const startPath = game.startPath.replace(/\//g, "\\\\");
    const fileUrl = game.file.url.replace(/^\/+/, "");
    const s3Url = `${process.env.GAME_S3_URL}/${fileUrl}`;
    const cleanupPolicy = determineCleanupPolicy(game);

    const payload = {
      session_id: session._id.toString(),
      game_id: game.gameName,
      build_id: buildId,
      s3_url: s3Url,
      format: game.file.format,
      start_path: startPath,
      storage_volume_id: session.storage?.volumeId || null,
      storage_device_name: session.storage?.deviceName || null,
      storage_mount_point: "D:",
      max_duration_seconds: session.maxDurationSeconds,
      backend_api_url: process.env.BACKEND_PUBLIC_URL,
      backend_api_key: process.env.INSTANCE_BACKEND_KEY,
      cleanup_on_normal_exit: cleanupPolicy.on_normal_exit,
      cleanup_on_violation: cleanupPolicy.on_violation,
      cleanup_on_timeout: cleanupPolicy.on_timeout,
      delete_game_files: cleanupPolicy.delete_game_files,
      shared_build: cleanupPolicy.shared_build,
      lockdown_enabled: true,
    };

    const controllerUrl = `http://${lease.ip}:4443/start-session`;

    console.log(`[Controller] Calling ${controllerUrl}`);
    console.log(`[Controller] Session=${session._id} instance=${session.instanceId}`);
    console.log("BEFORE FETCH", Date.now());

    /*
     * Execute in the background so the Express request
     * does not wait for the controller/session startup.
     */
    (async () => {
      let success = false;
      let lastErr = null;

      /*
       * --------------------------------------------------------
       * Try to start the session.
       * --------------------------------------------------------
       */
      for (let i = 0; i < 5; i++) {
        try {
          const response = await fetch(controllerUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": session._id.toString(),
            },
            body: JSON.stringify(payload),
          });

          const text = await response.text();

          console.log(`[Controller] Response ${response.status}: ${text}`);
          console.log("HEADERS RECEIVED", Date.now(), response.status);
          console.log("BODY RECEIVED", Date.now(), text);

          if (response.ok) {
            success = true;
            break;
          }

          lastErr = new Error(`Controller returned ${response.status}`);

          if (i < 4) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        } catch (err) {
          lastErr = err;
          console.warn(`[Controller] Fetch attempt ${i + 1} failed: ${err.message}`);

          if (i === 4) {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      /*
       * --------------------------------------------------------
       * Controller accepted the request.
       *
       * Nothing else needs to happen here.
       *
       * Rust will report:
       *   provisioning
       *   downloading
       *   launching
       *   running
       *   ended_and_ready
       *
       * through /api/internal/sessions/update.
       * --------------------------------------------------------
       */
      if (success) {
        console.log(`[Controller] Session start accepted session=${session._id}`);
        return;
      }

      console.error("FETCH FAILED AFTER 5 RETRIES", Date.now(), lastErr);

      /*
       * Mark the session as failed.
       *
       * Do not overwrite an exit reason that was already
       * recorded by another process.
       */
      await GameSession.findByIdAndUpdate(session._id, [
        {
          $set: {
            status: "failed",
            error: lastErr ? lastErr.message : "Controller did not return 200 OK",
            endedAt: new Date(),
            exitReason: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$exitReason", null] },
                    { $eq: ["$exitReason", ""] },
                  ],
                },
                "controller_error",
                "$exitReason",
              ],
            },
          },
        },
      ]);

      /*
       * --------------------------------------------------------
       * IMPORTANT:
       *
       * Do NOT synchronously delete the EBS volume here.
       *
       * AWS detach/delete is no longer part of GPU reuse.
       *
       * If the controller did receive the request and started
       * the session, the controller may still need to dismount
       * D: before the volume is detached.
       *
       * The background cleanup is therefore only safe if the
       * controller has already completed Windows-side cleanup.
       *
       * For this ambiguous start failure, we should NOT start
       * destructive storage cleanup blindly.
       * --------------------------------------------------------
       */

      /*
       * Try one best-effort stop request.
       *
       * If the controller did receive the start request, this
       * gives it a chance to terminate the session normally.
       *
       * If the controller never received it, this simply fails.
       */
      if (session.instanceIp) {
        try {
          const stopUrl = `http://${session.instanceIp}:4443/stop-session`;

          const stopResponse = await fetch(stopUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": session._id.toString(),
            },
            body: JSON.stringify({
              session_id: session._id.toString(),
            }),
            timeout: 5000,
          });

          const stopText = await stopResponse.text();

          console.log(`[Controller] Failure cleanup stop response ${stopResponse.status}: ${stopText}`);
        } catch (stopErr) {
          console.warn(
            `[Controller] Could not contact controller for failure cleanup session=${session._id}:`,
            stopErr.message
          );
        }
      }

      /*
       * --------------------------------------------------------
       * DO NOT release the GPU here.
       *
       * We cannot prove that the Rust controller is no longer
       * running the previous session.
       *
       * The safe release point remains:
       *
       *   Rust stops game
       *       ↓
       *   waits for exit
       *       ↓
       *   dismounts D:
       *       ↓
       *   verifies D:
       *       ↓
       *   ended_and_ready
       *       ↓
       *   releaseInstance()
       *
       * If the controller is unreachable, the stale-session /
       * reconciliation path must deal with the worker rather
       * than immediately reassigning it.
       * --------------------------------------------------------
       */

      /*
       * Do NOT call:
       *   releaseInstance(...)
       *   reconcileCapacity(...)
       * here.
       *
       * Releasing here could cause a running/unknown game
       * process to remain on a worker that is immediately
       * assigned to another user.
       */

      /*
       * --------------------------------------------------------
       * Storage cleanup:
       *
       * We also deliberately do NOT call
       * cleanupSessionStorageInBackground() here because we
       * don't have confirmation that Windows has dismounted
       * the volume.
       *
       * Once Rust sends ended_and_ready, the internal session
       * update handler starts background AWS cleanup.
       * --------------------------------------------------------
       */
      console.error(
        `[Controller] Session ${session._id} could not be confirmed as started or stopped. ` +
        `GPU release deferred until safe controller cleanup.`
      );
    })();

    console.log(`[Controller] Started session initialization for ${session._id}`);
  } catch (err) {
    console.error("[Controller] Error:", err);
    throw err;
  }
}

/**
 * Determine cleanup policy for the game.
 *
 * Builds are shared/persistent and must never be deleted
 * as part of normal session cleanup.
 */
function determineCleanupPolicy(game) {
  return {
    on_normal_exit: true,
    on_violation: true,
    on_timeout: true,
    // Never delete the build.
    delete_game_files: false,
    shared_build: false,
  };
}