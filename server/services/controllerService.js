import fetch from "node-fetch";
import GameSession from "../models/GameSession.js";
import AllPost from "../models/Allposts.js";
import { releaseInstance } from "./instanceAllocator.js";
import { reconcileCapacity } from "./capacityReconciler.js";
import { deleteSessionStorage } from "./sessionStorage.js";

export async function callController(session, lease) {
  try {
    const post = await AllPost.findById(session.gamePost)
      .select("gamePost")
      .lean();

    if (!post) {
      throw new Error("Game post not found");
    }

    const game = post.gamePost;
    const buildId = post._id.toString();
    const startPath = game.startPath.replace(/\//g, "\\");
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

      lockdown_enabled: true
    };

    console.log(`[Controller] Calling http://${lease.ip}:4443/start-session`);
    console.log("BEFORE FETCH", Date.now());

    // Execute in the background to prevent blocking the Express response
    (async () => {
      let success = false;
      let lastErr = null;

      for (let i = 0; i < 5; i++) {
        try {
          const r = await fetch(`http://${lease.ip}:4443/start-session`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": session._id.toString()
            },
            body: JSON.stringify(payload)
          });

          const text = await r.text();
          console.log(`[Controller] Response ${r.status}: ${text}`);
          console.log("HEADERS RECEIVED", Date.now(), r.status);
          console.log("BODY RECEIVED", Date.now(), text);

          if (r.ok) {
              success = true;
              break;
          }

          lastErr = new Error(
              `Controller returned ${r.status}`
          );

          if (i < 4) {
              await new Promise(r => setTimeout(r, 3000));
          }
        } catch (err) {
          lastErr = err;
          console.warn(`[Controller] Fetch attempt ${i + 1} failed: ${err.message}`);
          
          if (i === 4) break; 

          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // If all 5 attempts failed or returned non-200, run the failure logic
      if (!success) {
        console.error(
          "FETCH FAILED AFTER 5 RETRIES",
          Date.now(),
          lastErr
        );

await GameSession.findByIdAndUpdate(
  session._id,
  [
    {
      $set: {
        status: "failed",
        error: lastErr
          ? lastErr.message
          : "Controller did not return 200 OK",
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
  ]
);
        try {
          await deleteSessionStorage(session._id);
        } catch (storageErr) {
          console.error(
            `[Controller] Storage cleanup failed session=${session._id}:`,
            storageErr
          );
        }

        if (session.instanceId && session.leaseToken) {
          try {
            await releaseInstance(session.instanceId, session.leaseToken, session.instanceRegion);
          } catch (releaseErr) {
            console.error(
              "Release after controller failure failed:",
              releaseErr
            );
          }
        }

        reconcileCapacity(session.instanceRegion).catch(console.error);

      }
    })();

    console.log(`[Controller] Started session initialization for ${session._id}`);
  } catch (err) {
    console.error("[Controller] Error:", err);
    throw err;
  }
}

// function determineCleanupPolicy(game) {
//   const isLargeGame = game.file?.size > 1024 * 1024 * 1024;

//   return {
//     on_normal_exit: true,
//     on_violation: true,
//     on_timeout: true,
//     delete_game_files: isLargeGame,
//     shared_build: false
//   };
// }


function determineCleanupPolicy(game) {
  return {
    on_normal_exit: true,
    on_violation: true,
    on_timeout: true,

    // Never delete the build
    delete_game_files: false,

    shared_build: false
  };
}