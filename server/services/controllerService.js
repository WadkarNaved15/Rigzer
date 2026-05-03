import fetch from "node-fetch";
import GameSession from "../models/GameSession.js";
import AllPost from "../models/Allposts.js";
import { releaseInstance } from "./instanceAllocator.js";

export async function callController(session, lease) {
  try {
    const post = await AllPost.findById(session.gamePost)
      .select("gamePost")
      .lean();

    if (!post) {
      throw new Error("Game post not found");
    }

    const game = post.gamePost;

    const buildId = game.file.name;
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
    console.log(`[Controller] Payload`, JSON.stringify(payload, null, 2));

    fetch(`http://${lease.ip}:4443/start-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": session._id.toString()
      },
      body: JSON.stringify(payload)
    })
      .then(async (r) => {
        const text = await r.text();
        console.log(`[Controller] Response ${r.status}: ${text}`);
      })
      .catch(async (err) => {
        console.error(`[Controller] Fetch failed: ${err.message}`);

        await GameSession.findByIdAndUpdate(session._id, {
          status: "failed",
          exitReason: "controller_error",
          error: err.message,
          endedAt: new Date()
        });

        if (session.instanceId && session.leaseToken) {
          try {
            await releaseInstance(session.instanceId, session.leaseToken);
          } catch (releaseErr) {
            console.error(
              "Release after controller failure failed:",
              releaseErr
            );
          }
        }
      });

    console.log(`[Controller] Started session ${session._id}`);
  } catch (err) {
    console.error("[Controller] Error:", err);
    throw err;
  }
}

function determineCleanupPolicy(game) {
  const isLargeGame = game.file?.size > 1024 * 1024 * 1024;

  return {
    on_normal_exit: true,
    on_violation: true,
    on_timeout: true,
    delete_game_files: isLargeGame,
    shared_build: false
  };
}