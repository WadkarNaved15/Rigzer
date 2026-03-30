import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

const LEASE_LAMBDA_NAME = process.env.LEASE_LAMBDA_NAME || "leaseGpuWorker";
const RELEASE_LAMBDA_NAME = process.env.RELEASE_LAMBDA_NAME || "releaseGpuWorker";

/**
 * Lease a GPU instance
 * ✅ FIXED: Distinguishes SCALING from WAITING
 */
export async function assignOrStartInstance(requirements = {}) {
  try {
    const command = new InvokeCommand({
      FunctionName: LEASE_LAMBDA_NAME,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify(requirements)),
    });

    const response = await lambdaClient.send(command);
    const payload = JSON.parse(Buffer.from(response.Payload).toString());

    console.log("[Allocator] Lease response:", {
      status: payload.status,
      workerId: payload.workerId,
      reason: payload.reason
    });

    // ✅ CASE 1: Got instance immediately
    if (payload.status === "ASSIGNED") {
      return {
        id: payload.workerId,
        ip: payload.instanceIp,
        region: payload.region || "ap-south-1",
        hasGpu: true,
        leaseToken: payload.leaseToken,
        leaseExpiresAt: payload.leaseExpiresAt,
      };
    }

    // ✅ CASE 2: ASG at max → USER QUEUES (long wait)
    if (payload.status === "WAITING") {
      console.log("[Allocator] ASG at max capacity → User goes to QUEUE");
      return {
        scaling: false,
        queued: true,
        queuePosition: payload.queuePosition,
        totalQueued: payload.totalQueued,
        estimatedWaitMinutes: payload.estimatedWaitMinutes,
        avgSessionDuration: payload.avgSessionDuration,
      };
    }

    // ✅ CASE 3: ASG scaling → USER SKIPS QUEUE (short wait, show ads)
    if (payload.status === "SCALING") {
      console.log("[Allocator] ASG scaling up → User skips queue, shows ads");
      return {
        scaling: true,  // ✅ Skip queue notification
        queued: false,  // ✅ Not in queue
      };
    }

    if (payload.status === "RETRY") {
      throw new Error("Retry allocation");
    }

    throw new Error(`Unknown Lambda response: ${payload.status}`);
  } catch (err) {
    console.error("[Allocator] Lease error:", err.message);
    throw err;
  }
}

/**
 * Release a GPU instance
 * ✅ Already correct
 */
export async function releaseInstance(workerId, leaseToken) {
  if (!workerId || !leaseToken) {
    console.warn("[Allocator] Cannot release: missing workerId or leaseToken");
    return { success: false, reason: "Missing parameters" };
  }

  try {
    console.log("[Allocator] Releasing instance:", { workerId });

    const command = new InvokeCommand({
      FunctionName: RELEASE_LAMBDA_NAME,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(
        JSON.stringify({
          workerId,
          leaseToken,
        })
      ),
    });

    const response = await lambdaClient.send(command);
    const payload = JSON.parse(Buffer.from(response.Payload).toString());

    console.log("[Allocator] Release response:", {
      status: payload.status,
      reason: payload.reason,
      scaled: payload.scaled,
      workerId: payload.workerId
    });

    if (payload.status === "OK") {
      return {
        success: true,
        workerId: payload.workerId,
        scaled: payload.scaled || false,
        reason: payload.reason,
      };
    }

    if (payload.status === "ERROR") {
      console.error("[Allocator] Release failed:", payload.reason);
      return {
        success: false,
        workerId: payload.workerId,
        reason: payload.reason,
        error: payload.reason,
      };
    }

    console.warn("[Allocator] Unknown release response status:", payload.status);
    return {
      success: false,
      reason: `Unknown status: ${payload.status}`,
    };
  } catch (err) {
    console.error("[Allocator] Release exception:", err.message);
    return {
      success: false,
      error: err.message,
      workerId,
    };
  }
}