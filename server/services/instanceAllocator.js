import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { randomUUID } from "crypto";

const LEASE_LAMBDA_NAME = process.env.LEASE_LAMBDA_NAME || "leaseGpuWorker";
const RELEASE_LAMBDA_NAME = process.env.RELEASE_LAMBDA_NAME || "releaseGpuWorker";

const lambdaClients = new Map();

function getLambda(region) {
  if (!lambdaClients.has(region)) {
    lambdaClients.set(region, new LambdaClient({ region }));
  }
  return lambdaClients.get(region);
}

/**
 * Invoke Lease Lambda and safely parse its response.
 */
async function invokeLeaseLambda(region, payload) {
  const lambdaClient = getLambda(region);

  const command = new InvokeCommand({
    FunctionName: LEASE_LAMBDA_NAME,
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify(payload)),
  });

  const response = await lambdaClient.send(command);

  if (!response.Payload) {
    throw new Error("Lease Lambda returned an empty response");
  }

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(response.Payload).toString());
  } catch (err) {
    throw new Error(`Invalid Lease Lambda response: ${err.message}`);
  }

  /*
   * Lambda errors can sometimes be returned inside the
   * Invoke response rather than thrown by the SDK.
   */
  if (response.FunctionError) {
    throw new Error(
      parsed?.errorMessage || 
      parsed?.error || 
      "Lease Lambda execution failed"
    );
  }

  return parsed;
}

/**
 * Ask the Lease Lambda to wait for the EC2 instance created
 * by the current scale-up operation.
 *
 * IMPORTANT:
 * This does NOT wait for:
 *   - Windows boot
 *   - SSM
 *   - controller
 *   - DynamoDB worker registration
 *   - IDLE
 *
 * We only need:
 *   InstanceId
 *   AvailabilityZone
 *   IP information
 *
 * This allows EBS preparation to happen in parallel with
 * Windows/controller startup.
 */
async function waitForScaledInstance(region, baselineInstanceIds = [], timeoutMs = 60000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const payload = await invokeLeaseLambda(region, {
      action: "WAIT_FOR_INSTANCE",
      preferredRegion: region,
      baselineInstanceIds,
    });

    if (payload.status === "INSTANCE_FOUND") {
      return payload;
    }

    if (payload.status === "WAITING" || payload.status === "NOT_FOUND") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    if (payload.status === "ERROR") {
      throw new Error(payload.reason || "Failed waiting for scaled instance");
    }

    /*
     * Don't silently accept an unexpected response.
     */
    throw new Error(`Unexpected WAIT_FOR_INSTANCE response: ${payload.status}`);
  }

  throw new Error(`Timed out waiting for a new GPU instance in ${region}`);
}

/**
 * Lease a GPU instance.
 *
 * Cases:
 *
 * 1. IDLE instance exists
 *    -> immediately assigned
 *
 * 2. ASG is already at max
 *    -> WAITING / queue
 *
 * 3. ASG can scale
 *    -> trigger normal capacity reconciliation
 *    -> wait for the newly-created EC2
 *    -> return its InstanceId + AZ
 *
 * The third case is important because EBS preparation needs
 * the EC2 Availability Zone before the worker becomes IDLE.
 */
export async function assignOrStartInstance(requirements = {}) {
  const region = requirements.preferredRegion || "us-east-1";

  try {
    console.log("[Allocator] Requesting GPU allocation:", { region, requirements });
    const allocationRequestId = randomUUID();
    /*
     * -------------------------------------------------------
     * STEP 1
     * -------------------------------------------------------
     *
     * Ask the Lease Lambda whether we can immediately
     * assign an existing worker or whether scaling is needed.
     */
    const leasePayload = {
      action: "LEASE",
      ...requirements,
      preferredRegion: region,
      allocationRequestId,
    };

    const payload = await invokeLeaseLambda(region, leasePayload);

    console.log("[Allocator] Lease response:", {
      status: payload.status,
      workerId: payload.workerId,
      reason: payload.reason,
    });

    /*
     * -------------------------------------------------------
     * CASE 1: Existing worker available
     * -------------------------------------------------------
     */
    if (payload.status === "ASSIGNED") {
      console.log("[Allocator] Existing GPU worker assigned:", payload.workerId);

      return {
        status: "ASSIGNED",
        workerId: payload.workerId,
        instanceIp: payload.instanceIp,

        /*
         * AZ is useful for storage creation.
         * The Lease Lambda should return this for existing workers as well.
         */
        availabilityZone: payload.availabilityZone || null,
        region,
        hasGpu: true,
        leaseToken: payload.leaseToken,
        leaseExpiresAt: payload.leaseExpiresAt,
      };
    }

    /*
     * -------------------------------------------------------
     * CASE 2: ASG is at maximum capacity
     * -------------------------------------------------------
     *
     * This is a real queue situation.
     */
    if (payload.status === "WAITING") {
      console.log("[Allocator] ASG at maximum capacity -> queue user");

      return {
        status: "WAITING",
        scaling: false,
        queued: true,
        queuePosition: payload.queuePosition,
        totalQueued: payload.totalQueued,
        estimatedWaitMinutes: payload.estimatedWaitMinutes,
        avgSessionDuration: payload.avgSessionDuration,
      };
    }

    /*
     * -------------------------------------------------------
     * CASE 3: ASG needs to scale
     * -------------------------------------------------------
     *
     * This is NOT a queue.
     * We want to reserve the newly-created machine for this
     * session and start EBS preparation immediately.
     */
/*
 * -------------------------------------------------------
 * CASE 3: ASG needs to scale
 * -------------------------------------------------------
 *
 * IMPORTANT:
 * This is NOT a queue.
 *
 * We return immediately.
 *
 * The session remains:
 *   status = "waiting"
 *   queueType = "direct"
 *   allocation.type = "scaling"
 *
 * A background coordinator will:
 *   1. discover the new EC2
 *   2. associate it with this session
 *   3. wait for the worker to become ready
 *   4. prepare the EBS volume
 *   5. start the controller only when both are ready
 */
if (payload.status === "SCALING") {
  console.log("[Allocator] ASG scaling -> returning immediately");

  const baselineInstanceIds = Array.isArray(payload.baselineInstanceIds)
    ? payload.baselineInstanceIds
    : [];

  const requestId =
    payload.allocationRequestId || allocationRequestId;

  const reconcilePayload = {
    action: "RECONCILE",
    preferredRegion: region,
    requiredCapacity:
      payload.targetCapacity ??
      payload.targetDesiredCapacity ??
      payload.desiredCapacity ??
      null,
    allocationRequestId: requestId,
  };

  /*
   * Trigger capacity reconciliation asynchronously.
   *
   * Do NOT wait for:
   * - EC2 creation
   * - Windows boot
   * - SSM
   * - controller
   * - DynamoDB registration
   * - IDLE state
   */
  if (!payload.scalingTriggered) {
    console.log(
      "[Allocator] Triggering capacity reconciliation:",
      reconcilePayload
    );

    const lambdaClient = getLambda(region);

    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: LEASE_LAMBDA_NAME,
        InvocationType: "Event",
        Payload: Buffer.from(
          JSON.stringify(reconcilePayload)
        ),
      })
    );
  }

  return {
    status: "SCALING",
    scaling: true,
    queued: false,

    allocationRequestId: requestId,
    baselineInstanceIds,

    region,
    hasGpu: true,

    /*
     * No instance is assigned yet.
     */
    workerId: null,
    instanceId: null,
    instanceIp: null,
    privateIp: null,
    publicIp: null,
    availabilityZone: null,

    /*
     * No worker lease exists yet.
     */
    leaseToken: null,
    leaseExpiresAt: null,

    /*
     * Capacity information is useful for
     * the session/coordinator.
     */
    desiredCapacity: payload.desiredCapacity ?? null,
    targetCapacity:
      payload.targetCapacity ??
      payload.targetDesiredCapacity ??
      null,
  };
}

    /*
     * -------------------------------------------------------
     * CASE 4: Temporary retry
     * -------------------------------------------------------
     */
    if (payload.status === "RETRY") {
      throw new Error("Retry allocation");
    }

    throw new Error(`Unknown Lease Lambda response: ${payload.status}`);
  } catch (err) {
    console.error("[Allocator] Allocation error:", err);
    throw err;
  }
}


/**
 * Lease one exact GPU worker.
 *
 * Used when a scaling allocation has already discovered
 * the specific EC2 instance that belongs to the session.
 *
 * IMPORTANT:
 * Do NOT use assignOrStartInstance() here.
 *
 * assignOrStartInstance() can choose any available IDLE worker.
 * This function can only lease the requested worker.
 */
export async function leaseSpecificInstance(
  workerId,
  region
) {
  if (!workerId || !region) {
    throw new Error(
      "workerId and region are required"
    );
  }

  try {
    console.log(
      "[Allocator] Requesting specific GPU lease:",
      {
        workerId,
        region,
      }
    );

    const payload = await invokeLeaseLambda(
      region,
      {
        action: "LEASE_SPECIFIC",
        preferredRegion: region,
        workerId,
        instanceId: workerId,
      }
    );

    console.log(
      "[Allocator] Specific lease response:",
      {
        status: payload.status,
        workerId: payload.workerId,
        reason: payload.reason,
      }
    );

    if (payload.status === "ASSIGNED") {
      return {
        status: "ASSIGNED",

        workerId:
          payload.workerId || workerId,

        instanceId:
          payload.instanceId ||
          payload.workerId ||
          workerId,

        instanceIp:
          payload.instanceIp || null,

        privateIp:
          payload.privateIp || null,

        publicIp:
          payload.publicIp || null,

        availabilityZone:
          payload.availabilityZone || null,

        region,

        hasGpu: true,

        leaseToken:
          payload.leaseToken,

        leaseExpiresAt:
          payload.leaseExpiresAt,
      };
    }

    /*
     * The instance exists but is not ready for leasing yet.
     *
     * This is NOT a failure.
     *
     * The caller should retry when the worker becomes IDLE.
     */
    if (payload.status === "NOT_READY") {
      return {
        status: "NOT_READY",
        workerId,
        instanceId: workerId,
        region,
        reason: payload.reason,
      };
    }

    if (payload.status === "CONFLICT") {
      return {
        status: "CONFLICT",
        workerId,
        instanceId: workerId,
        region,
        reason: payload.reason,
      };
    }

    return {
      status: payload.status || "ERROR",
      workerId,
      instanceId: workerId,
      region,
      reason:
        payload.reason ||
        "Specific worker lease failed",
    };

  } catch (err) {
    console.error(
      "[Allocator] Specific lease error:",
      err
    );

    throw err;
  }
}

/**
 * Release a GPU instance.
 *
 * Only call this after a real worker lease exists.
 */
export async function releaseInstance(workerId, leaseToken, region) {
  if (!workerId || !leaseToken || !region) {
    console.warn("[Allocator] Cannot release: missing parameters");
    return {
      success: false,
      reason: "Missing workerId, leaseToken or region",
    };
  }

  try {
    console.log("[Allocator] Releasing instance:", { workerId, region });
    const lambdaClient = getLambda(region);

    const command = new InvokeCommand({
      FunctionName: RELEASE_LAMBDA_NAME,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(
        JSON.stringify({
          workerId,
          leaseToken,
          preferredRegion: region,
        })
      ),
    });

    const response = await lambdaClient.send(command);

    const payload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : {};

    console.log("[Allocator] Release response:", {
      status: payload.status,
      reason: payload.reason,
      workerId: payload.workerId,
      released: payload.released,
    });

    if (payload.status === "OK") {
      return {
        success: true,
        workerId: payload.workerId,
        released: payload.released === true,
        reason: payload.reason,
      };
    }

    if (payload.status === "ERROR") {
      /*
       * Worker was already reassigned.
       * Don't allow cleanup to fail just because the lease token is stale.
       */
      if (payload.reason === "Lease token mismatch") {
        console.warn("[Allocator] Instance already reassigned; ignoring release");
        return {
          success: true,
          workerId: payload.workerId,
          reason: "already reassigned",
        };
      }

      console.error("[Allocator] Release failed:", payload.reason);
      return {
        success: false,
        workerId: payload.workerId,
        reason: payload.reason,
      };
    }

    return {
      success: false,
      reason: `Unknown status: ${payload.status}`,
      workerId: payload.workerId,
    };
  } catch (err) {
    console.error("[Allocator] Release exception:", err);
    return {
      success: false,
      workerId,
      error: err.message,
    };
  }
}

/**
 * Renew an existing GPU worker lease.
 */
export async function renewLease(workerId, region) {
  if (!workerId || !region) {
    console.warn("[Allocator] Cannot renew: missing workerId or region");
    return;
  }

  const lambdaClient = getLambda(region);

  const command = new InvokeCommand({
    FunctionName: LEASE_LAMBDA_NAME,
    InvocationType: "Event", // Renewal doesn't need to block the request.
    Payload: Buffer.from(
      JSON.stringify({
        action: "RENEW",
        preferredRegion: region,
        workerId,
      })
    ),
  });

  await lambdaClient.send(command);
}