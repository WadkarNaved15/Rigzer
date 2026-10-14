import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeVolumesCommand,
  CreateVolumeCommand,
  AttachVolumeCommand,
  DetachVolumeCommand,
  DeleteVolumeCommand,
} from "@aws-sdk/client-ec2";

import GameSession from "../models/GameSession.js";
import AllPost from "../models/Allposts.js";
import { reconcileCapacity } from "./capacityReconciler.js";
import { releaseInstance } from "./instanceAllocator.js";

function getEc2(region) {
  return new EC2Client({ region });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the actual AZ of the EC2 instance.
 *
 * EBS volumes are AZ-specific, so we MUST use the
 * actual EC2 placement rather than guessing an AZ.
 */
async function getInstancePlacement(region, instanceId) {
  const ec2 = getEc2(region);

  const result = await ec2.send(
    new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    })
  );

  const instance = result.Reservations?.[0]?.Instances?.[0];

  if (!instance) {
    throw new Error(`EC2 instance not found: ${instanceId}`);
  }

  if (instance.State?.Name !== "running") {
    throw new Error(
      `EC2 instance ${instanceId} is not running`
    );
  }

  const availabilityZone = instance.Placement?.AvailabilityZone;

  if (!availabilityZone) {
    throw new Error(
      `Availability Zone unavailable for ${instanceId}`
    );
  }

  return {
    availabilityZone,
    privateIp: instance.PrivateIpAddress || null,
    publicIp: instance.PublicIpAddress || null,
  };
}

/**
 * Find the already-created READY snapshot for this
 * game's region.
 *
 * IMPORTANT:
 * Never use sourceSnapshotId here if a regional
 * snapshot exists.
 */
async function getRegionalReadySnapshot(session) {
  const post = await AllPost.findById(session.gamePost)
    .select("gamePost.snapshot")
    .lean();

  if (!post?.gamePost) {
    throw new Error(
      `Game post not found: ${session.gamePost}`
    );
  }

  const game = post.gamePost;
  const region = session.instanceRegion;

  const regionalSnapshot = game.snapshot?.regions?.find(
    item =>
      item.region === region &&
      item.status === "ready" &&
      item.snapshotId
  );

  if (!regionalSnapshot) {
    throw new Error(
      `No READY snapshot available for game=${session.gamePost} region=${region}`
    );
  }

  return {
    snapshotId: regionalSnapshot.snapshotId,
    region,
  };
}

/**
 * Wait until CreateVolume has produced an available volume.
 */
async function waitForVolumeAvailable(
  ec2,
  volumeId,
  timeoutMs = 120000
) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await ec2.send(
      new DescribeVolumesCommand({
        VolumeIds: [volumeId],
      })
    );

    const volume = result.Volumes?.[0];

    if (!volume) {
      throw new Error(
        `Volume disappeared: ${volumeId}`
      );
    }

    if (volume.State === "available") {
      return volume;
    }

    if (volume.State === "error") {
      throw new Error(
        `EBS volume entered error state: ${volumeId}`
      );
    }

    await sleep(2000);
  }

  throw new Error(
    `Timed out waiting for EBS volume ${volumeId}`
  );
}

/**
 * Wait until AWS reports the volume attached.
 */
async function waitForVolumeAttached(
  ec2,
  volumeId,
  instanceId,
  timeoutMs = 180000
) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await ec2.send(
      new DescribeVolumesCommand({
        VolumeIds: [volumeId],
      })
    );

    const volume = result.Volumes?.[0];

    const attachment = volume?.Attachments?.find(
      attachment =>
        attachment.InstanceId === instanceId
    );

    if (
      attachment &&
      attachment.State === "attached"
    ) {
      return attachment;
    }

    await sleep(2000);
  }

  throw new Error(
    `Timed out waiting for volume ${volumeId} to attach`
  );
}

/**
 * Wait until AWS reports that the volume is detached.
 */
async function waitForVolumeDetached(
  ec2,
  volumeId,
  timeoutMs = 180000
) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await ec2.send(
      new DescribeVolumesCommand({
        VolumeIds: [volumeId],
      })
    );

    const volume = result.Volumes?.[0];

    /*
     * Volume no longer exists.
     * This is effectively detached for our cleanup purposes.
     */
    if (!volume) {
      return;
    }

    const activeAttachments =
      volume.Attachments?.filter(
        attachment =>
          attachment.State !== "detached"
      ) || [];

    if (activeAttachments.length === 0) {
      return;
    }

    await sleep(2000);
  }

  throw new Error(
    `Timed out waiting for volume ${volumeId} to detach`
  );
}


/**
 * Create the session's private EBS volume from the
 * correct regional READY snapshot.
 *
 * This function is idempotent:
 *
 * pending   -> creates volume
 * creating  -> does not create another volume
 * attaching -> does not create another volume
 * ready     -> returns immediately
 */
export async function createSessionStorage(sessionId) {
  /*
   * ----------------------------------------------------------
   * STEP 1
   * Atomically claim storage creation.
   * ----------------------------------------------------------
   */
  const session = await GameSession.findOneAndUpdate(
    {
      _id: sessionId,
      "storage.status": "pending",
      instanceId: { $ne: null },
      instanceRegion: { $ne: null },
    },
    {
      $set: {
        "storage.status": "creating",
        "storage.error": null,
      },
    },
    {
      new: true,
    }
  );

  /*
   * Someone else is already creating/has created it.
   */
  if (!session) {
    const existing = await GameSession.findById(sessionId)
      .select("instanceId instanceRegion storage")
      .lean();

    if (!existing) {
      throw new Error(
        `Session not found: ${sessionId}`
      );
    }

    if (existing.storage?.status === "ready") {
      return existing;
    }

    if (
      existing.storage?.status === "creating" ||
      existing.storage?.status === "attaching"
    ) {
      return existing;
    }

    throw new Error(
      `Session ${sessionId} cannot start storage creation`
    );
  }

  try {
    const region = session.instanceRegion;
    const instanceId = session.instanceId;
    const ec2 = getEc2(region);

    /*
     * --------------------------------------------------------
     * STEP 2
     * Get actual EC2 AZ.
     * --------------------------------------------------------
     */
    const placement = await getInstancePlacement(
      region,
      instanceId
    );

    await GameSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          "storage.availabilityZone":
            placement.availabilityZone,
        },
      }
    );

    /*
     * --------------------------------------------------------
     * STEP 3
     * Find READY regional snapshot.
     * --------------------------------------------------------
     */
    const { snapshotId } =
      await getRegionalReadySnapshot(session);

    await GameSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          "storage.snapshotId": snapshotId,
        },
      }
    );

    console.log(
      `[SessionStorage] Session=${sessionId} ` +
      `region=${region} snapshot=${snapshotId} ` +
      `AZ=${placement.availabilityZone}`
    );

    /*
     * --------------------------------------------------------
     * STEP 4
     * Create volume FROM snapshot.
     *
     * No size is specified intentionally.
     * AWS uses the snapshot's size.
     * --------------------------------------------------------
     */
    const volumeResult = await ec2.send(
      new CreateVolumeCommand({
        SnapshotId: snapshotId,
        AvailabilityZone:
          placement.availabilityZone,
        VolumeType: "gp3",
        TagSpecifications: [
          {
            ResourceType: "volume",
            Tags: [
              {
                Key: "Name",
                Value: `rigzer-session-${sessionId}`,
              },
              {
                Key: "RigzerSessionId",
                Value: sessionId.toString(),
              },
              {
                Key: "RigzerGamePostId",
                Value: session.gamePost.toString(),
              },
              {
                Key: "RigzerRegion",
                Value: region,
              },
            ],
          },
        ],
      })
    );

    const volumeId = volumeResult.VolumeId;

    if (!volumeId) {
      throw new Error(
        "CreateVolume returned no VolumeId"
      );
    }

    /*
     * --------------------------------------------------------
     * CRITICAL:
     * Save volumeId immediately.
     *
     * If Node crashes after CreateVolume,
     * cleanup can still find the volume.
     * --------------------------------------------------------
     */
    await GameSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          "storage.volumeId": volumeId,
        },
      }
    );

    console.log(
      `[SessionStorage] Created volume=${volumeId} ` +
      `from snapshot=${snapshotId}`
    );

    /*
     * --------------------------------------------------------
     * STEP 5
     * Wait for EBS availability.
     * --------------------------------------------------------
     */
    await waitForVolumeAvailable(
      ec2,
      volumeId
    );

    /*
     * --------------------------------------------------------
     * STEP 6
     * Attach volume.
     *
     * This is the EC2 device identifier.
     * The Windows side must mount the resulting disk as D:.
     * --------------------------------------------------------
     */
    const deviceName = "xvdf";

    await GameSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          "storage.status": "attaching",
          "storage.deviceName": deviceName,
        },
      }
    );

    await ec2.send(
      new AttachVolumeCommand({
        VolumeId: volumeId,
        InstanceId: instanceId,
        Device: deviceName,
      })
    );

    /*
     * --------------------------------------------------------
     * STEP 7
     * Wait for AWS attachment.
     * --------------------------------------------------------
     */
    await waitForVolumeAttached(
      ec2,
      volumeId,
      instanceId
    );

    /*
     * --------------------------------------------------------
     * STEP 8
     * Storage READY.
     * --------------------------------------------------------
     */
    const readyAt = new Date();

    const updatedSession =
      await GameSession.findByIdAndUpdate(
        sessionId,
        {
          $set: {
            "storage.status": "ready",
            "storage.attachedAt": readyAt,
            "storage.readyAt": readyAt,
            "storage.error": null,
          },
        },
        {
          new: true,
        }
      );

    console.log(
      `[SessionStorage] READY session=${sessionId} ` +
      `volume=${volumeId} instance=${instanceId}`
    );

    return updatedSession;

  } catch (error) {

    console.error(
      `[SessionStorage] Failed session=${sessionId}:`,
      error
    );

    const failedSession =
      await GameSession.findOneAndUpdate(
        {
          _id: sessionId,
          status: {
            $in: [
              "waiting",
              "allocation_ready",
              "starting",
            ],
          },
        },
        {
          $set: {
            status: "failed",
            phase: null,
            endedAt: new Date(),
            exitReason: "storage_error",
            error:
              error.message ||
              "Storage creation failed",
            "storage.status": "failed",
            "storage.error":
              error.message ||
              "Storage creation failed",
          },
        },
        {
          new: true,
        }
      )
        .select(
          "instanceId instanceRegion leaseToken storage"
        )
        .lean();

    /*
     * Only the process that successfully changed the
     * session to failed owns the resource cleanup.
     */
    if (failedSession) {

      /*
       * Storage creation failure is different from normal
       * session termination.
       *
       * The instance has not been handed to another session
       * yet, so it is safe to synchronously attempt cleanup
       * before releasing the GPU.
       */
      try {
        await deleteSessionStorage(sessionId);
      } catch (storageErr) {
        /*
         * IMPORTANT:
         *
         * Do not prevent GPU release just because EBS cleanup
         * failed during provisioning.
         *
         * deleteSessionStorage() records the failure/lease state,
         * and the cleanup worker can retry it later.
         */
        console.error(
          `[SessionStorage] Cleanup failed session=${sessionId}:`,
          storageErr
        );
      }

      if (
        failedSession.instanceId &&
        failedSession.leaseToken &&
        failedSession.instanceRegion
      ) {
        try {

          const releaseResult =
            await releaseInstance(
              failedSession.instanceId,
              failedSession.leaseToken,
              failedSession.instanceRegion
            );

          /*
           * releaseInstance() can return success:false
           * without throwing.
           */
          if (!releaseResult?.success) {
            throw new Error(
              releaseResult?.reason ||
              releaseResult?.error ||
              "GPU release failed"
            );
          }

        } catch (releaseErr) {

          console.error(
            `[SessionStorage] GPU release failed session=${sessionId}:`,
            releaseErr
          );
        }

        reconcileCapacity(
          failedSession.instanceRegion
        ).catch(err => {
          console.error(
            `[SessionStorage] Reconcile failed session=${sessionId}:`,
            err
          );
        });
      }
    }

    throw error;
  }
}


/**
 * Delete a session volume.
 *
 * Idempotent and safe when multiple cleanup paths
 * attempt to clean the same session simultaneously.
 *
 * This deletes ONLY the temporary session volume.
 * It NEVER deletes the game snapshot.
 *
 * Cleanup states:
 *
 *   pending/creating/attaching/ready/failed
 *       -> detaching
 *       -> deleted
 *
 * If cleanup crashes while in "detaching", an expired
 * cleanup lease allows a future cleanup worker to reclaim it.
 */
export async function deleteSessionStorage(sessionId) {

  /*
   * ----------------------------------------------------------
   * STEP 1
   * Atomically claim cleanup.
   *
   * Normal cleanup claims:
   *
   *   pending
   *   creating
   *   attaching
   *   ready
   *   failed
   *
   * A previous cleanup may have crashed while in "detaching".
   * In that case, once its lease expires, another worker may
   * reclaim the cleanup.
   * ----------------------------------------------------------
   */

  const cleanupStartedAt = new Date();

  /*
   * The longest AWS operation currently waited on is
   * waitForVolumeDetached() = 180 seconds.
   *
   * Give the cleanup owner enough time so another cleanup
   * worker does not steal the lease while the first worker
   * is legitimately waiting for AWS.
   */
  const CLEANUP_LEASE_MS = 5 * 60 * 1000;

  const cleanupLeaseExpiresAt = new Date(
    cleanupStartedAt.getTime() +
    CLEANUP_LEASE_MS
  );


  /*
   * First try to claim a fresh cleanup.
   */
  let claimed =
    await GameSession.findOneAndUpdate(
      {
        _id: sessionId,

        "storage.status": {
          $in: [
            "pending",
            "creating",
            "attaching",
            "ready",
            "failed",
          ],
        },
      },
      {
        $set: {
          "storage.status": "detaching",
          "storage.cleanupStartedAt":
            cleanupStartedAt,
          "storage.cleanupLeaseExpiresAt":
            cleanupLeaseExpiresAt,
        },
      },
      {
        new: true,
      }
    )
      .select(
        "instanceId instanceRegion storage"
      )
      .lean();


  /*
   * ----------------------------------------------------------
   * STEP 1B
   *
   * If another cleanup process already owns "detaching",
   * normally do nothing.
   *
   * BUT if its cleanup lease has expired, reclaim it.
   *
   * This handles:
   *
   *   Node crash
   *   process kill
   *   worker restart
   *   network failure
   *   unexpected exception
   * ----------------------------------------------------------
   */
  if (!claimed) {

    claimed =
      await GameSession.findOneAndUpdate(
        {
          _id: sessionId,

          "storage.status": "detaching",

          /*
           * Only reclaim an abandoned cleanup.
           */
          "storage.cleanupLeaseExpiresAt": {
            $lte: cleanupStartedAt,
          },
        },
        {
          $set: {
            "storage.status": "detaching",
            "storage.cleanupStartedAt":
              cleanupStartedAt,
            "storage.cleanupLeaseExpiresAt":
              cleanupLeaseExpiresAt,
          },
        },
        {
          new: true,
        }
      )
        .select(
          "instanceId instanceRegion storage"
        )
        .lean();
  }


  /*
   * ----------------------------------------------------------
   * Nothing to do.
   *
   * This happens when:
   *
   * - another request currently owns cleanup
   * - cleanup already completed
   * - session doesn't exist
   * ----------------------------------------------------------
   */
  if (!claimed) {
    return;
  }


  const volumeId =
    claimed.storage?.volumeId;


  /*
   * No AWS volume exists.
   */
  if (!volumeId) {

    await GameSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          "storage.status": "deleted",
          "storage.error": null,
        },
        $unset: {
          "storage.cleanupStartedAt": "",
          "storage.cleanupLeaseExpiresAt": "",
        },
      }
    );

    return;
  }


  if (!claimed.instanceRegion) {
    throw new Error(
      `Cannot delete storage: no region for ${sessionId}`
    );
  }


  const ec2 =
    getEc2(claimed.instanceRegion);


  try {

    /*
     * ----------------------------------------------------------
     * STEP 2
     * Describe volume.
     * ----------------------------------------------------------
     */
    let result;

    try {

      result = await ec2.send(
        new DescribeVolumesCommand({
          VolumeIds: [volumeId],
        })
      );

    } catch (error) {

      /*
       * AWS already deleted the volume.
       *
       * This is a successful/idempotent outcome.
       */
      if (
        error.name ===
          "InvalidVolume.NotFound" ||
        String(error.name)
          .toLowerCase()
          .includes("notfound")
      ) {

        await GameSession.findByIdAndUpdate(
          sessionId,
          {
            $set: {
              "storage.status": "deleted",
              "storage.error": null,
            },
            $unset: {
              "storage.cleanupStartedAt": "",
              "storage.cleanupLeaseExpiresAt": "",
            },
          }
        );

        return;
      }

      throw error;
    }


    const volume =
      result.Volumes?.[0];


    /*
     * Volume no longer exists.
     */
    if (!volume) {

      await GameSession.findByIdAndUpdate(
        sessionId,
        {
          $set: {
            "storage.status": "deleted",
            "storage.error": null,
          },
          $unset: {
            "storage.cleanupStartedAt": "",
            "storage.cleanupLeaseExpiresAt": "",
          },
        }
      );

      return;
    }


    /*
     * ----------------------------------------------------------
     * STEP 3
     * Detach if necessary.
     *
     * IMPORTANT:
     *
     * This AWS detach happens AFTER the Windows-side Rust
     * dismount has already occurred during normal session
     * termination.
     *
     * AWS detach is therefore NOT part of GPU reuse.
     * ----------------------------------------------------------
     */
    const activeAttachments =
      volume.Attachments?.filter(
        attachment =>
          attachment.State !== "detached"
      ) || [];


    if (activeAttachments.length > 0) {

      /*
       * Normally there should only be one attachment.
       */
      for (const attachment of activeAttachments) {

        try {

          await ec2.send(
            new DetachVolumeCommand({
              VolumeId: volumeId,
              InstanceId:
                attachment.InstanceId,
              Force: false,
            })
          );

        } catch (error) {

          /*
           * If somebody else already detached it,
           * that's fine.
           */
          const message =
            String(
              error.message || ""
            ).toLowerCase();


          if (
            error.name ===
              "InvalidVolume.NotFound" ||
            message.includes("not found") ||
            message.includes("already detached") ||
            message.includes("incorrectstate")
          ) {

            console.warn(
              `[SessionStorage] Volume ${volumeId} ` +
              `already transitioning during detach`
            );

          } else {

            throw error;
          }
        }
      }


      await waitForVolumeDetached(
        ec2,
        volumeId
      );
    }


    /*
     * ----------------------------------------------------------
     * STEP 4
     * Delete volume.
     * ----------------------------------------------------------
     */
    try {

      await ec2.send(
        new DeleteVolumeCommand({
          VolumeId: volumeId,
        })
      );

    } catch (error) {

      /*
       * Another cleanup process may have deleted it.
       *
       * Treat that as success.
       */
      if (
        error.name ===
          "InvalidVolume.NotFound" ||
        String(error.name)
          .toLowerCase()
          .includes("notfound")
      ) {

        console.log(
          `[SessionStorage] Volume already deleted=${volumeId}`
        );

      } else {

        throw error;
      }
    }


    /*
     * ----------------------------------------------------------
     * STEP 5
     * Persist final state.
     * ----------------------------------------------------------
     */
    await GameSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          "storage.status": "deleted",
          "storage.error": null,
        },
        $unset: {
          "storage.cleanupStartedAt": "",
          "storage.cleanupLeaseExpiresAt": "",
        },
      }
    );


    console.log(
      `[SessionStorage] Deleted session volume=${volumeId}`
    );


  } catch (error) {

    console.error(
      `[SessionStorage] Failed to delete volume=${volumeId}:`,
      error
    );


    /*
     * IMPORTANT:
     *
     * Keep the state as "detaching".
     *
     * The cleanup worker will see the expired cleanup lease
     * and retry this volume later.
     *
     * Do NOT change it to "failed" because "detaching" means
     * AWS cleanup is still pending/retryable.
     */
    await GameSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          "storage.error":
            error.message ||
            "Storage deletion failed",
        },
      }
    );


    throw error;
  }
}


/**
 * Start AWS EBS cleanup without blocking the caller.
 *
 * IMPORTANT:
 *
 * This is NOT used to decide when a GPU worker becomes reusable.
 *
 * The Rust controller must first:
 *
 *   1. stop the game
 *   2. wait for the supervisor/game to exit
 *   3. dismount the Windows EBS volume
 *   4. confirm D: is free
 *
 * Only after that should the caller release the GPU and invoke
 * this background cleanup.
 */
export function cleanupSessionStorageInBackground(
  sessionId
) {
  deleteSessionStorage(sessionId)
    .then(() => {
      console.log(
        `[SessionStorage] Background AWS cleanup completed ` +
        `session=${sessionId}`
      );
    })
    .catch(error => {
      console.error(
        `[SessionStorage] Background AWS cleanup failed ` +
        `session=${sessionId}:`,
        error
      );
    });
}