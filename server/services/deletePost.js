// services/deletePost.service.js

import AllPost from "../models/Allposts.js";
import Like from "../models/Like.js";
import Comment from "../models/Comment.js";
import Wishlist from "../models/Wishlist.js";
import PostAnalytics from "../models/postAnalytics.js";
import Notification from "../models/Notifications.js";

import {
  EC2Client,
  DeleteSnapshotCommand,
} from "@aws-sdk/client-ec2";

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../s3.js";
import { extractS3KeyFromUrl } from "../utils/extractS3Key.js";
import GamePostDraft from "../models/GamePostDraft.js";

export async function deletePostAndAssets(post) {
  const keysToDelete = [];

  const getThumbnailKey = (thumbUrl) => {
    if (!thumbUrl) return null;
    return extractS3KeyFromUrl(thumbUrl);
  };

  // =====================================================
  // GAME SNAPSHOTS
  // =====================================================

  if (post.type === "game_post") {
    const snapshot = post.gamePost?.snapshot;

    if (snapshot) {
      const snapshotsToDelete = new Map();

      // Regional snapshots
      for (const regionSnapshot of snapshot.regions || []) {
        const region = regionSnapshot?.region;
        const snapshotId = regionSnapshot?.snapshotId;

        if (!region || !snapshotId) {
          continue;
        }

        snapshotsToDelete.set(
          `${region}:${snapshotId}`,
          {
            region,
            snapshotId,
          }
        );
      }

      // Also handle sourceSnapshotId in case it is not
      // present inside the regions array.
      if (
        snapshot.sourceRegion &&
        snapshot.sourceSnapshotId
      ) {
        snapshotsToDelete.set(
          `${snapshot.sourceRegion}:${snapshot.sourceSnapshotId}`,
          {
            region: snapshot.sourceRegion,
            snapshotId: snapshot.sourceSnapshotId,
          }
        );
      }

      if (snapshotsToDelete.size > 0) {
        console.log(
          `[DeletePost] Deleting ${snapshotsToDelete.size} game snapshot(s) for post ${post._id}`
        );

        const snapshotResults = await Promise.allSettled(
          [...snapshotsToDelete.values()].map(
            async ({ region, snapshotId }) => {
              const ec2 = new EC2Client({
                region,
              });

              try {
                await ec2.send(
                  new DeleteSnapshotCommand({
                    SnapshotId: snapshotId,
                  })
                );

                console.log(
                  `[DeletePost] Deleted snapshot ${snapshotId} in ${region}`
                );

                return {
                  region,
                  snapshotId,
                  success: true,
                };
              } catch (error) {
                // If the snapshot is already gone, treat it
                // as successfully cleaned up.
                if (
                  error?.name ===
                    "InvalidSnapshot.NotFound" ||
                  error?.name === "InvalidSnapshotID.NotFound"
                ) {
                  console.log(
                    `[DeletePost] Snapshot ${snapshotId} already deleted in ${region}`
                  );

                  return {
                    region,
                    snapshotId,
                    success: true,
                    alreadyDeleted: true,
                  };
                }

                console.error(
                  `[DeletePost] Failed to delete snapshot ${snapshotId} in ${region}:`,
                  error
                );

                throw error;
              }
            }
          )
        );

        const failedSnapshots =
          snapshotResults.filter(
            (result) => result.status === "rejected"
          );

        if (failedSnapshots.length > 0) {
          throw new Error(
            `Failed to delete ${failedSnapshots.length} game snapshot(s)`
          );
        }
      }
    }

    // Game build
    if (post.gamePost?.file?.key) {
      keysToDelete.push(
        post.gamePost.file.key
      );
    }

    // Original video
    if (post.gamePost?.videoDemo?.key) {
      keysToDelete.push(
        post.gamePost.videoDemo.key
      );
    }

    // Optimized video
    if (
      post.gamePost?.videoDemo?.optimizedKey
    ) {
      keysToDelete.push(
        post.gamePost.videoDemo.optimizedKey
      );
    }

    // Thumbnail
    const thumb = getThumbnailKey(
      post.gamePost?.videoDemo?.thumbnailUrl
    );

    if (thumb) {
      keysToDelete.push(thumb);
    }
  }

  // =====================================================
  // NORMAL POST
  // =====================================================

  if (post.type === "normal_post") {
    for (const asset of post.normalPost?.assets || []) {
      if (asset.key) {
        keysToDelete.push(asset.key);
      }

      if (asset.optimizedKey) {
        keysToDelete.push(asset.optimizedKey);
      }

      const thumb = getThumbnailKey(
        asset.thumbnailUrl
      );

      if (thumb) {
        keysToDelete.push(thumb);
      }
    }
  }

  // =====================================================
  // MODEL POST
  // =====================================================

  if (post.type === "model_post") {
    for (
      const asset of
      post.modelPost?.assets || []
    ) {
      if (asset.originalKey) {
        keysToDelete.push(
          asset.originalKey
        );
      }

      if (asset.optimizedKey) {
        keysToDelete.push(
          asset.optimizedKey
        );
      }
    }
  }

  // =====================================================
  // MEDIA AD
  // =====================================================

  if (
    post.type === "media_ad_post" &&
    post.mediaAdPost?.asset
  ) {
    if (post.mediaAdPost.asset.key) {
      keysToDelete.push(
        post.mediaAdPost.asset.key
      );
    }

    if (
      post.mediaAdPost.asset.optimizedKey
    ) {
      keysToDelete.push(
        post.mediaAdPost.asset.optimizedKey
      );
    }
  }

  // =====================================================
  // AD MODEL
  // =====================================================

  if (
    post.type === "ad_model_post" &&
    post.adModelPost?.asset
  ) {
    if (
      post.adModelPost.asset.originalKey
    ) {
      keysToDelete.push(
        post.adModelPost.asset.originalKey
      );
    }

    if (
      post.adModelPost.asset.optimizedKey
    ) {
      keysToDelete.push(
        post.adModelPost.asset.optimizedKey
      );
    }
  }

  // =====================================================
  // S3 ASSETS
  // =====================================================

  await Promise.all(
    [...new Set(keysToDelete)].map(
      (key) =>
        s3.send(
          new DeleteObjectCommand({
            Bucket:
              process.env.AWS_BUCKET_NAME,
            Key: key,
          })
        )
    )
  );

  // =====================================================
  // DATABASE CLEANUP
  // =====================================================

  await Promise.all([
    Like.deleteMany({
      post: post._id,
    }),

    Comment.deleteMany({
      post: post._id,
    }),

    Wishlist.deleteMany({
      post: post._id,
    }),

    Notification.deleteMany({
      postId: post._id,
    }),

    PostAnalytics.deleteOne({
      post: post._id,
    }),

    AllPost.findByIdAndDelete(
      post._id
    ),
  ]);
}


export async function deleteDraftAndAssets(draft) {
  const keysToDelete = [];

  const getThumbnailKey = (url) => {
    if (!url) return null;
    return extractS3KeyFromUrl(url);
  };

  if (draft.buildFile?.key) {
    keysToDelete.push(draft.buildFile.key);
  }

  if (draft.videoDemo?.key) {
    keysToDelete.push(draft.videoDemo.key);
  }

  if (draft.videoDemo?.optimizedKey) {
    keysToDelete.push(
      draft.videoDemo.optimizedKey
    );
  }

  const thumb = getThumbnailKey(
    draft.videoDemo?.thumbnailUrl
  );

  if (thumb) {
    keysToDelete.push(thumb);
  }

  await Promise.allSettled(
    [...new Set(keysToDelete)].map(
      (key) =>
        s3.send(
          new DeleteObjectCommand({
            Bucket:
              process.env.AWS_BUCKET_NAME,
            Key: key,
          })
        )
    )
  );

  await draft.deleteOne();
}
