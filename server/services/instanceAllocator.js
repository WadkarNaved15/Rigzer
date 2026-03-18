import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

const LEASE_LAMBDA_NAME = process.env.LEASE_LAMBDA_NAME || "leaseGpuWorker";
const RELEASE_LAMBDA_NAME =
  process.env.RELEASE_LAMBDA_NAME || "releaseGpuWorker";

export async function assignOrStartInstance(requirements = {}) {
  const command = new InvokeCommand({
    FunctionName: LEASE_LAMBDA_NAME,
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify(requirements)),
  });

  const response = await lambdaClient.send(command);
  const payload = JSON.parse(Buffer.from(response.Payload).toString());

  console.log("Lambda raw payload:", payload);


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

  if (payload.status === "SCALING" || payload.status === "WAITING") {
    return { scaling: true };
  }

  if (payload.status === "RETRY") {
    throw new Error("Retry allocation");
  }

  throw new Error("Unknown Lambda response");
}

export async function releaseInstance(workerId, leaseToken) {
  if (!workerId || !leaseToken) return;

  const command = new InvokeCommand({
    FunctionName: RELEASE_LAMBDA_NAME,
    InvocationType: "Event", // async
    Payload: Buffer.from(
      JSON.stringify({
        workerId,
        leaseToken,
      })
    ),
  });

  await lambdaClient.send(command);
}
