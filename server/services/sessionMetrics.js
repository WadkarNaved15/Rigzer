import { EventEmitter } from "events";

/**
 * Session metrics tracking service
 * Tracks session lifecycle, failures, and performance
 */
export class SessionMetrics extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      sessionsStarted: 0,
      sessionsEnded: 0,
      sessionsFailed: 0,
      failures: {},
    };

    // Periodically log metrics
    this.logInterval = setInterval(() => {
      this.logMetrics();
    }, 60000); // Every minute
  }

  recordSessionStart(userId, gamePostId, instanceId) {
    this.metrics.sessionsStarted++;
    this.emit("session:start", { userId, gamePostId, instanceId, timestamp: Date.now() });
  }

  recordSessionEnd(userId, sessionId) {
    this.metrics.sessionsEnded++;
    this.emit("session:end", { userId, sessionId, timestamp: Date.now() });
  }

  recordFailure(type, userId) {
    this.metrics.sessionsFailed++;
    
    if (!this.metrics.failures[type]) {
      this.metrics.failures[type] = 0;
    }
    this.metrics.failures[type]++;

    this.emit("session:failure", { type, userId, timestamp: Date.now() });
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.calculateSuccessRate(),
      timestamp: Date.now(),
    };
  }

  calculateSuccessRate() {
    const total = this.metrics.sessionsStarted + this.metrics.sessionsFailed;
    if (total === 0) return 100;
    return ((this.metrics.sessionsStarted / total) * 100).toFixed(2);
  }

  logMetrics() {
    const metrics = this.getMetrics();
    console.log("[SessionMetrics]", JSON.stringify(metrics, null, 2));
  }

  reset() {
    this.metrics = {
      sessionsStarted: 0,
      sessionsEnded: 0,
      sessionsFailed: 0,
      failures: {},
    };
  }

  cleanup() {
    if (this.logInterval) {
      clearInterval(this.logInterval);
    }
  }
}

export default SessionMetrics;