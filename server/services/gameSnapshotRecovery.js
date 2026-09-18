import AllPost from "../models/Allposts.js";
import { gameSnapshotQueue } from "../queues/gameSnapshotQueue.js";

const SNAPSHOT_SOURCE_REGION =
  process.env.GAME_SNAPSHOT_SOURCE_REGION || "ap-south-1";

const SNAPSHOT_TARGET_REGIONS = (
  process.env.GAME_SNAPSHOT_REGIONS ||
  "ap-south-1,ap-southeast-1,eu-central-1,us-east-1"
)
  .split(",")
  .map(r => r.trim())
  .filter(Boolean);

export async function retryFailedGameSnapshots(postId) {
  const post = await AllPost.findOne({
    _id: postId,
    type: "game_post",
  });

  if (!post) {
    const error = new Error("Game post not found");
    error.statusCode = 404;
    throw error;
  }

  const snapshot = post.gamePost?.snapshot;

  if (!snapshot) {
    const error = new Error(
      "Snapshot information does not exist for this game"
    );
    error.statusCode = 400;
    throw error;
  }

  if (snapshot.status === "ready") {
    const error = new Error(
      "Game snapshots are already ready"
    );
    error.statusCode = 400;
    throw error;
  }

  /*
   * ---------------------------------------------------------
   * MODE 1:
   * Source snapshot does not exist.
   *
   * We must restart the COMPLETE snapshot pipeline.
   * ---------------------------------------------------------
   */
  if (!snapshot.sourceSnapshotId) {
    const targetRegions =
      SNAPSHOT_TARGET_REGIONS.length > 0
        ? SNAPSHOT_TARGET_REGIONS
        : [SNAPSHOT_SOURCE_REGION];

    await AllPost.updateOne(
      { _id: post._id },
      {
        $set: {
          "gamePost.snapshot.status": "pending",

          "gamePost.snapshot.sourceRegion":
            SNAPSHOT_SOURCE_REGION,

          "gamePost.snapshot.sourceSnapshotId":
            null,

          "gamePost.snapshot.sourceVolumeId":
            null,

          "gamePost.snapshot.regions":
            [],

          "gamePost.snapshot.error":
            null,

          "gamePost.snapshot.createdAt":
            new Date(),

          "gamePost.snapshot.completedAt":
            null,
        },
      }
    );

    const job = await gameSnapshotQueue.add(
      "prepareGameSnapshot",
      {
        gamePostId: post._id.toString(),

        gameId:
          post.gamePost.gameName,

        buildId:
          post._id.toString(),

        startPath:
          post.gamePost.startPath,

        s3Key:
          post.gamePost.file.key,

        s3Url:
          post.gamePost.file.url,

        format:
          post.gamePost.file.format,

        buildSize:
          post.gamePost.file.size,

        sourceRegion:
          SNAPSHOT_SOURCE_REGION,

        targetRegions,

        recovery: false,

        recoveryRegions: [],

        snapshot: null,
      },
      {
        /*
         * Do NOT reuse the original snapshot jobId.
         * A retained BullMQ job could otherwise prevent
         * the retry from being queued.
         */
        jobId: `snapshot-retry-${post._id}-${Date.now()}`,

        attempts: 3,

        backoff: {
          type: "exponential",
          delay: 10000,
        },

        removeOnComplete: 500,
        removeOnFail: 500,
      }
    );

    return {
      mode: "full",
      postId: post._id.toString(),
      sourceSnapshotId: null,
      recoveryRegions: [],
      jobId: job.id,
    };
  }

  /*
   * ---------------------------------------------------------
   * MODE 2:
   * Source snapshot exists.
   *
   * Retry only regions that aren't READY.
   * ---------------------------------------------------------
   */

  const recoveryRegions = (
    snapshot.regions || []
  )
    .filter(region =>
      region.region !== snapshot.sourceRegion &&
      (
        region.status !== "ready" ||
        !region.snapshotId
      )
    )
    .map(region => region.region);

  if (recoveryRegions.length === 0) {
    const error = new Error(
      "No failed snapshot regions require recovery"
    );
    error.statusCode = 400;
    throw error;
  }

  await AllPost.updateOne(
    { _id: post._id },
    {
      $set: {
        "gamePost.snapshot.status":
          "replicating",

        "gamePost.snapshot.error":
          null,

        "gamePost.snapshot.completedAt":
          null,
      },
    }
  );

  const job = await gameSnapshotQueue.add(
    "recoverGameSnapshots",
    {
      gamePostId: post._id.toString(),

      gameId:
        post.gamePost.gameName,

      buildId:
        post._id.toString(),

      startPath:
        post.gamePost.startPath,

      s3Key:
        post.gamePost.file.key,

      s3Url:
        post.gamePost.file.url,

      format:
        post.gamePost.file.format,

      buildSize:
        post.gamePost.file.size,

      sourceRegion:
        snapshot.sourceRegion,

      targetRegions:
        SNAPSHOT_TARGET_REGIONS,

      recovery: true,

      recoveryRegions,

      snapshot: {
        sourceRegion:
          snapshot.sourceRegion,

        sourceSnapshotId:
          snapshot.sourceSnapshotId,
      },
    },
    {
      jobId:
        `snapshot-recovery-${post._id}-${Date.now()}`,

      attempts: 3,

      backoff: {
        type: "exponential",
        delay: 10000,
      },

      removeOnComplete: 500,
      removeOnFail: 500,
    }
  );

  return {
    mode: "regional",
    postId: post._id.toString(),
    sourceSnapshotId:
      snapshot.sourceSnapshotId,
    recoveryRegions,
    jobId: job.id,
  };
}