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
import { finalizeSession } from "../helper/session.js";

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
    new DescribeInstancesCommand({ InstanceIds: [instanceId] })
  );

  const instance = result.Reservations?.[0]?.Instances?.[0];

  if (!instance) {
    throw new Error(`EC2 instance not found: ${instanceId}`);
  }

  if (instance.State?.Name !== "running") {
    throw new Error(`EC2 instance ${instanceId} is not running`);
  }

  const availabilityZone = instance.Placement?.AvailabilityZone;

  if (!availabilityZone) {
    throw new Error(`Availability Zone unavailable for ${instanceId}`);
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
    throw new Error(`Game post not found: ${session.gamePost}`);
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
async function waitForVolumeAvailable(ec2, volumeId, timeoutMs = 120000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await ec2.send(
      new DescribeVolumesCommand({ VolumeIds: [volumeId] })
    );

    const volume = result.Volumes?.[0];

    if (!volume) {
      throw new Error(`Volume disappeared: ${volumeId}`);
    }

    if (volume.State === "available") {
      return volume;
    }

    if (volume.State === "error") {
      throw new Error(`EBS volume entered error state: ${volumeId}`);
    }

    await sleep(2000);
  }

  throw new Error(`Timed out waiting for EBS volume ${volumeId}`);
}

/**
 * Wait until AWS reports the volume attached.
 */
async function waitForVolumeAttached(ec2, volumeId, instanceId, timeoutMs = 60000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await ec2.send(
      new DescribeVolumesCommand({ VolumeIds: [volumeId] })
    );

    const volume = result.Volumes?.[0];
    const attachment = volume?.Attachments?.find(
      attachment => attachment.InstanceId === instanceId
    );

    if (attachment && attachment.State === "attached") {
      return attachment;
    }

    await sleep(2000);
  }

  throw new Error(`Timed out waiting for volume ${volumeId} to attach`);
}


async function waitForVolumeDetached(
  ec2,
  volumeId,
  timeoutMs = 60000
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
    { new: true }
  );

  /*
   * Someone else is already creating/has created it.
   */
  if (!session) {
    const existing = await GameSession.findById(sessionId)
      .select("instanceId instanceRegion storage")
      .lean();

    if (!existing) {
      throw new Error(`Session not found: ${sessionId}`);
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

    throw new Error(`Session ${sessionId} cannot start storage creation`);
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
    const placement = await getInstancePlacement(region, instanceId);

    await GameSession.findByIdAndUpdate(sessionId, {
      $set: { "storage.availabilityZone": placement.availabilityZone },
    });

    /*
     * --------------------------------------------------------
     * STEP 3
     * Find READY regional snapshot.
     * --------------------------------------------------------
     */
    const { snapshotId } = await getRegionalReadySnapshot(session);

    await GameSession.findByIdAndUpdate(sessionId, {
      $set: { "storage.snapshotId": snapshotId },
    });

    console.log(
      `[SessionStorage] Session=${sessionId} region=${region} ` +
      `snapshot=${snapshotId} AZ=${placement.availabilityZone}`
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
        AvailabilityZone: placement.availabilityZone,
        VolumeType: "gp3",
        TagSpecifications: [
          {
            ResourceType: "volume",
            Tags: [
              { Key: "Name", Value: `rigzer-session-${sessionId}` },
              { Key: "RigzerSessionId", Value: sessionId.toString() },
              { Key: "RigzerGamePostId", Value: session.gamePost.toString() },
              { Key: "RigzerRegion", Value: region },
            ],
          },
        ],
      })
    );

    const volumeId = volumeResult.VolumeId;

    if (!volumeId) {
      throw new Error("CreateVolume returned no VolumeId");
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
    await GameSession.findByIdAndUpdate(sessionId, {
      $set: { "storage.volumeId": volumeId },
    });

    console.log(`[SessionStorage] Created volume=${volumeId} from snapshot=${snapshotId}`);

    /*
     * --------------------------------------------------------
     * STEP 5
     * Wait for EBS availability.
     * --------------------------------------------------------
     */
    await waitForVolumeAvailable(ec2, volumeId);

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

    await GameSession.findByIdAndUpdate(sessionId, {
      $set: {
        "storage.status": "attaching",
        "storage.deviceName": deviceName,
      },
    });

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
    await waitForVolumeAttached(ec2, volumeId, instanceId);

    /*
     * --------------------------------------------------------
     * STEP 8
     * Storage READY.
     * --------------------------------------------------------
     */
    const readyAt = new Date();

    const updatedSession = await GameSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          "storage.status": "ready",
          "storage.attachedAt": readyAt,
          "storage.readyAt": readyAt,
          "storage.error": null,
        },
      },
      { new: true }
    );

    console.log(`[SessionStorage] READY session=${sessionId} volume=${volumeId} instance=${instanceId}`);

    return updatedSession;

} catch (error) {
  console.error(`[SessionStorage] Failed session=${sessionId}:`, error);

  const failedSession = await GameSession.findOneAndUpdate(
    {
      _id: sessionId,
      status: { $in: ["waiting", "allocation_ready", "starting"] },
    },
    {
      $set: {
        status: "failed",
        phase: null,
        endedAt: new Date(),
        exitReason: "storage_error",
        error: error.message || "Storage creation failed",
        "storage.status": "failed",
        "storage.error": error.message || "Storage creation failed",
      },
    },
    { new: true }
  )
    .select("instanceId instanceRegion leaseToken storage")
    .lean();

  // Only the process that successfully changed the session to failed
  // owns the resource cleanup.
  if (failedSession) {
    try {
      await deleteSessionStorage(sessionId);
    } catch (storageErr) {
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
        await releaseInstance(
          failedSession.instanceId,
          failedSession.leaseToken,
          failedSession.instanceRegion
        );
      } catch (releaseErr) {
        console.error(
          `[SessionStorage] GPU release failed session=${sessionId}:`,
          releaseErr
        );
      }

      reconcileCapacity(failedSession.instanceRegion).catch(err => {
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
 */
export async function deleteSessionStorage(sessionId) {
  /*
   * ----------------------------------------------------------
   * STEP 1
   * Atomically claim cleanup.
   *
   * Only ONE caller is allowed to move the volume into
   * "detaching".
   *
   * Other callers seeing "detaching" or "deleted" simply return.
   * ----------------------------------------------------------
   */
    const cleanupStartedAt = new Date();
    const cleanupLeaseExpiresAt = new Date(
    cleanupStartedAt.getTime() + 2 * 60 * 1000
    );

    const claimed = await GameSession.findOneAndUpdate(
    {
        _id: sessionId,
        "storage.status": {
        $in: [
            "pending",
            "creating",
            "attaching",
            "ready",
            "failed"
        ],
        },
    },
    {
        $set: {
        "storage.status": "detaching",
        "storage.cleanupStartedAt": cleanupStartedAt,
        "storage.cleanupLeaseExpiresAt": cleanupLeaseExpiresAt,
        },
    },
    { new: true }
    )
    .select("instanceId instanceRegion storage")
    .lean();

  /*
   * ----------------------------------------------------------
   * Nothing to do.
   *
   * This happens when:
   *
   * - another request already owns cleanup
   * - cleanup already completed
   * - session doesn't exist
   * ----------------------------------------------------------
   */
  if (!claimed) {
    return;
  }

  const volumeId = claimed.storage?.volumeId;

  /*
   * No AWS volume exists.
   */
  if (!volumeId) {
    await GameSession.findByIdAndUpdate(sessionId, {
      $set: { "storage.status": "deleted" },
    });
    return;
  }

  if (!claimed.instanceRegion) {
    throw new Error(`Cannot delete storage: no region for ${sessionId}`);
  }

  const ec2 = getEc2(claimed.instanceRegion);

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
        new DescribeVolumesCommand({ VolumeIds: [volumeId] })
      );
    } catch (error) {
      /*
       * AWS already deleted the volume.
       *
       * This is a successful/idempotent outcome.
       */
      if (
        error.name === "InvalidVolume.NotFound" ||
        String(error.name).toLowerCase().includes("notfound")
      ) {
        await GameSession.findByIdAndUpdate(sessionId, {
          $set: { "storage.status": "deleted" },
        });
        return;
      }
      throw error;
    }

    const volume = result.Volumes?.[0];

    /*
     * Volume no longer exists.
     */
    if (!volume) {
      await GameSession.findByIdAndUpdate(sessionId, {
        $set: { "storage.status": "deleted" },
      });
      return;
    }

    /*
     * ----------------------------------------------------------
     * STEP 3
     * Detach if necessary.
     *
     * Because this caller owns the "detaching" state,
     * another cleanup caller will not execute this section.
     * ----------------------------------------------------------
     */
    const activeAttachments = volume.Attachments?.filter(
      attachment => attachment.State !== "detached"
    ) || [];

    if (activeAttachments.length > 0) {
      /*
       * Detach every active attachment belonging to this
       * session volume.
       *
       * Normally there should only be one.
       */
      for (const attachment of activeAttachments) {
        try {
          await ec2.send(
            new DetachVolumeCommand({
              VolumeId: volumeId,
              InstanceId: attachment.InstanceId,
              Force: false,
            })
          );
        } catch (error) {
          /*
           * If somebody else already detached it,
           * that's fine.
           */
          const message = String(error.message || "").toLowerCase();

          if (
            error.name === "InvalidVolume.NotFound" ||
            message.includes("not found") ||
            message.includes("already detached") ||
            message.includes("incorrectstate")
          ) {
            console.warn(`[SessionStorage] Volume ${volumeId} already transitioning during detach`);
          } else {
            throw error;
          }
        }
      }

      await waitForVolumeDetached(ec2, volumeId);
    }

    /*
     * ----------------------------------------------------------
     * STEP 4
     * Delete volume.
     * ----------------------------------------------------------
     */
    try {
      await ec2.send(
        new DeleteVolumeCommand({ VolumeId: volumeId })
      );
    } catch (error) {
      /*
       * Another cleanup process may have deleted it.
       * Treat that as success.
       */
      if (
        error.name === "InvalidVolume.NotFound" ||
        String(error.name).toLowerCase().includes("notfound")
      ) {
        console.log(`[SessionStorage] Volume already deleted=${volumeId}`);
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
    await GameSession.findByIdAndUpdate(sessionId, {
      $set: {
        "storage.status": "deleted",
        "storage.error": null,
      },
    });

    console.log(`[SessionStorage] Deleted session volume=${volumeId}`);

  } catch (error) {
    console.error(`[SessionStorage] Failed to delete volume=${volumeId}:`, error);

    /*
     * Do NOT change to "failed" here.
     *
     * "detaching" means cleanup is in progress.
     * A cleanup worker can retry this later.
     */
    await GameSession.findByIdAndUpdate(sessionId, {
      $set: {
        "storage.error": error.message || "Storage deletion failed",
      },
    });

    throw error;
  }
}