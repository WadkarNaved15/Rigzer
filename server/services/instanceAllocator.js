import fetch from "node-fetch";

/**
 * ⚠️ TEMPORARY SINGLE-INSTANCE MODE
 *
 * - Uses INSTANCE_POOL from env
 * - Picks FIRST healthy instance
 * - No load balancing
 * - No autoscaling
 * - No cache / Redis
 */

// Instance pool configuration (kept for future use)
const INSTANCE_CONFIG = { 
  healthCheckInterval: 30000, // 30 seconds
  healthCheckTimeout: 5000,
};

// In-memory instance pool
class InstancePool {
  constructor() {
    this.instances = new Map();
    this.healthCheckInterval = null;
  }

  async initialize() {
    console.log(
      "[InstanceAllocator] Initializing instance pool (single-instance mode)",
      process.env.INSTANCE_POOL
    );

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

    for (const config of instancesConfig) {
      this.instances.set(config.id, {
        id: config.id,
        ip: config.ip,
        region: config.region || "local",
        hasGpu: config.hasGpu || false,
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

    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      INSTANCE_CONFIG.healthCheckInterval
    );

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

      const response = await fetch(
        `http://${instance.ip}:4443/health`,
        { method: "GET", signal: controller.signal }
      );

      clearTimeout(timeout);

      if (response.ok) {
        console.log("✅ Instance healthy:", instance.id, instance.ip);
        instance.status = "healthy";
        instance.lastHealthCheck = Date.now();
      } else {
        instance.status = "unhealthy";
      }
    } catch (err) {
      instance.status = "unreachable";
      console.error(
        `[InstanceAllocator] Health check failed for ${instance.id}:`,
        err.message
      );
    }
  }

  /**
   * 🔹 SINGLE INSTANCE SELECTION
   * Returns the first healthy instance
   */
  getFirstHealthyInstance() {
    for (const instance of this.instances.values()) {
      if (instance.status === "healthy") {
        return instance;
      }
    }
    return null;
  }

  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

// Singleton pool
const instancePool = new InstancePool();

/**
 * Assign an instance
 * (no autoscaling, no load balancing)
 */
export async function assignOrStartInstance(requirements = {}) {
  console.log(
    "[InstanceAllocator] Assigning instance (single-instance mode)",
    requirements
  );

  const instance = instancePool.getFirstHealthyInstance();

  if (!instance) {
    throw new Error("No healthy instance available");
  }

  console.log(
    "[InstanceAllocator] Assigned instance:",
    instance.id,
    instance.ip
  );

  return {
    id: instance.id,
    ip: instance.ip,
    region: instance.region,
    hasGpu: instance.hasGpu,
  };
}

/**
 * Release instance
 * (NO-OP in single-instance mode)
 */
export async function releaseInstance(instanceId) {
  console.log(
    "[InstanceAllocator] releaseInstance ignored (single-instance mode):",
    instanceId
  );
}

/**
 * Initialize instance pool
 */
export async function initializeInstancePool() {
  await instancePool.initialize();
  console.log("[InstanceAllocator] Instance pool initialized");
}

/**
 * Get pool status (for admin/debug)
 */
export function getInstancePoolStatus() {
  const instances = Array.from(instancePool.instances.values());

  return {
    total: instances.length,
    healthy: instances.filter((i) => i.status === "healthy").length,
    unhealthy: instances.filter((i) => i.status === "unhealthy").length,
    unreachable: instances.filter((i) => i.status === "unreachable").length,
    instances: instances.map((i) => ({
      id: i.id,
      ip: i.ip,
      region: i.region,
      status: i.status,
      hasGpu: i.hasGpu,
      lastHealthCheck: i.lastHealthCheck,
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
