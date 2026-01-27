import fetch from "node-fetch";
import cacheService from "./cacheService.js";

/**
 * Production-grade instance allocator with load balancing,
 * health checks, and fallback strategies
 */

// Instance pool configuration
const INSTANCE_CONFIG = { 
  healthCheckInterval: 30000, // 30 seconds
  healthCheckTimeout: 5000, 
  maxRetries: 3,
  retryDelay: 1000,
  instanceTimeout: 10000,
};

// In-memory instance pool (in production, use a database)
class InstancePool {
  constructor() {
    this.instances = new Map();
    this.healthCheckInterval = null;
  }

async initialize() {
  console.log("[InstanceAllocator] Initializing instance pool...", process.env.INSTANCE_POOL);
  if (!process.env.INSTANCE_POOL) {
    throw new Error("INSTANCE_POOL env var not set");
  }

  let instancesConfig;
  try {
    instancesConfig = JSON.parse(process.env.INSTANCE_POOL);
  } catch (err) {
    console.error("❌ Invalid INSTANCE_POOL JSON:", process.env.INSTANCE_POOL);
    throw err;
  }

  console.log("[InstanceAllocator] Loaded instances:", instancesConfig);

  for (const config of instancesConfig) {
    this.instances.set(config.id, {
      id: config.id,
      ip: config.ip,
      region: config.region,
      hasGpu: config.hasGpu || false,
      maxConcurrent: config.maxConcurrent || 1,
      currentLoad: 0,
      status: "unknown",
      lastHealthCheck: null,
    });
  }

  this.startHealthChecks();
}

  startHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, INSTANCE_CONFIG.healthCheckInterval);

    // Run immediately
    this.performHealthChecks();
  }

  async performHealthChecks() {
    const checks = Array.from(this.instances.values()).map((instance) =>
      this.checkInstanceHealth(instance)
    );

    await Promise.allSettled(checks);
  }

  async checkInstanceHealth(instance) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        INSTANCE_CONFIG.healthCheckTimeout
      );

      const response = await fetch(`http://${instance.ip}:4443/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        instance.status = "healthy";
        instance.currentLoad = data.currentSessions || 0;
        instance.lastHealthCheck = Date.now();
      } else {
        instance.status = "unhealthy";
      }
    } catch (err) {
      instance.status = "unreachable";
      console.error(`Health check failed for ${instance.id}:`, err.message);
    }
  }

  getHealthyInstances(requireGpu = false) {
    return Array.from(this.instances.values()).filter(
      (i) =>
        i.status === "healthy" &&
        i.currentLoad < i.maxConcurrent &&
        (!requireGpu || i.hasGpu)
    );
  }

  selectBestInstance(instances) {
    if (instances.length === 0) return null;

    // Sort by load (least loaded first)
    instances.sort((a, b) => a.currentLoad - b.currentLoad);

    return instances[0];
  }

  async incrementLoad(instanceId) {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.currentLoad++;
      
      // Cache the load for distributed systems
      await cacheService.incrementInstanceLoad(instanceId);
    }
  }

  async decrementLoad(instanceId) {
    const instance = this.instances.get(instanceId);
    if (instance && instance.currentLoad > 0) {
      instance.currentLoad--;
      
      // Update cache
      await cacheService.decrementInstanceLoad(instanceId);
    }
  }

  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

// Singleton instance pool
const instancePool = new InstancePool();

/**
 * Assign or start a game instance
 */
export async function assignOrStartInstance(requirements = {}) {
  const { gpuRequired = false, ramGB, cpuCores, timeout = INSTANCE_CONFIG.instanceTimeout } = requirements;

  console.log("[InstanceAllocator] Assigning instance with requirements:", requirements);

  // Get healthy instances that match requirements
  const availableInstances = instancePool.getHealthyInstances(gpuRequired);

  if (availableInstances.length === 0) {
    // No instances available - try to start a new one
    const newInstance = await startNewInstance(requirements);
    
    if (!newInstance) {
      throw new Error("No instances available and unable to start new instance");
    }

    return newInstance;
  }

  // Select best instance based on current load
  const instance = instancePool.selectBestInstance(availableInstances);

  if (!instance) {
    throw new Error("Failed to select instance");
  }

  // Increment load counter
  await instancePool.incrementLoad(instance.id);

  return {
    id: instance.id,
    ip: instance.ip,
    region: instance.region,
    hasGpu: instance.hasGpu,
  };
}

/**
 * Start a new instance (cloud provider integration)
 */
async function startNewInstance(requirements) {
  try {
    // In production, integrate with AWS, GCP, or Azure
    // For now, return null to indicate we can't auto-scale
    
    console.log("[InstanceAllocator] Auto-scaling not implemented");
    
    // Example AWS EC2 integration:
    // const ec2 = new AWS.EC2();
    // const params = {
    //   ImageId: requirements.gpuRequired ? GPU_AMI_ID : CPU_AMI_ID,
    //   InstanceType: selectInstanceType(requirements),
    //   MinCount: 1,
    //   MaxCount: 1,
    // };
    // const result = await ec2.runInstances(params).promise();
    // return { id: result.Instances[0].InstanceId, ... };

    return null;
  } catch (err) {
    console.error("[InstanceAllocator] Failed to start new instance:", err);
    return null;
  }
}

/**
 * Release an instance when session ends
 */
export async function releaseInstance(instanceId) {
  await instancePool.decrementLoad(instanceId);
}

/**
 * Initialize the instance pool
 */
export async function initializeInstancePool() {
  await instancePool.initialize();
  console.log("[InstanceAllocator] Instance pool initialized");
}

/**
 * Get instance pool status
 */
export function getInstancePoolStatus() {
  const instances = Array.from(instancePool.instances.values());
  
  return {
    total: instances.length,
    healthy: instances.filter((i) => i.status === "healthy").length,
    unhealthy: instances.filter((i) => i.status === "unhealthy").length,
    unreachable: instances.filter((i) => i.status === "unreachable").length,
    totalLoad: instances.reduce((sum, i) => sum + i.currentLoad, 0),
    instances: instances.map((i) => ({
      id: i.id,
      region: i.region,
      status: i.status,
      load: `${i.currentLoad}/${i.maxConcurrent}`,
      hasGpu: i.hasGpu,
    })),
  };
}

/**
 * Cleanup on shutdown
 */
export function cleanupInstancePool() {
  instancePool.cleanup();
}

export default {
  assignOrStartInstance,
  releaseInstance,
  initializeInstancePool,
  getInstancePoolStatus,
  cleanupInstancePool,
};