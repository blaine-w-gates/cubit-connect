/**
 * SyncConnectionManager
 * 
 * Manages WebSocket connection health, automatic reconnection,
 * and connection state validation for Yjs sync.
 * 
 * Features:
 * - Connection health monitoring (heartbeat tracking)
 * - Automatic reconnection with exponential backoff
 * - Connection state validation
 * - Peer presence verification
 * - Recovery actions on connection failure
 */

export interface ConnectionHealth {
  isHealthy: boolean;
  lastHeartbeatReceived: number;
  lastHeartbeatSent: number;
  missedHeartbeats: number;
  consecutiveFailures: number;
  reconnectAttempts: number;
  peerCount: number;
  messagesSent: number;
  messagesReceived: number;
}

export interface ReconnectionConfig {
  maxReconnectAttempts: number;
  baseDelay: number;
  maxDelay: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  presenceTimeout: number;
}

const DEFAULT_RECONNECT_CONFIG: ReconnectionConfig = {
  maxReconnectAttempts: 15,
  baseDelay: 3000,
  maxDelay: 60000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 5000,
  presenceTimeout: 12000,
};

export class SyncConnectionManager {
  private health: ConnectionHealth = {
    isHealthy: false,
    lastHeartbeatReceived: 0,
    lastHeartbeatSent: 0,
    missedHeartbeats: 0,
    consecutiveFailures: 0,
    reconnectAttempts: 0,
    peerCount: 0,
    messagesSent: 0,
    messagesReceived: 0,
  };

  private config: ReconnectionConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private onReconnectCallback: (() => void) | null = null;
  private onHealthChangeCallback: ((health: ConnectionHealth) => void) | null = null;
  private onPeerLostCallback: (() => void) | null = null;

  constructor(config: Partial<ReconnectionConfig> = {}) {
    this.config = { ...DEFAULT_RECONNECT_CONFIG, ...config };
  }

  /**
   * Record a successful heartbeat reception
   */
  recordHeartbeat(): void {
    this.health.lastHeartbeatReceived = Date.now();
    this.health.missedHeartbeats = 0;
    this.health.consecutiveFailures = 0;
    this.health.isHealthy = true;
    this.notifyHealthChange();
  }

  /**
   * Record a heartbeat sent
   */
  recordHeartbeatSent(): void {
    this.health.lastHeartbeatSent = Date.now();
  }

  /**
   * Record a missed heartbeat
   */
  recordMissedHeartbeat(): void {
    this.health.missedHeartbeats++;
    
    if (this.health.missedHeartbeats >= 2) {
      this.health.isHealthy = false;
      this.health.consecutiveFailures++;
      this.notifyHealthChange();
      
      // Trigger reconnection if connection appears dead
      if (this.health.consecutiveFailures >= 2) {
        this.scheduleReconnection();
      }
    }
  }

  /**
   * Update peer count and detect peer loss
   */
  updatePeerCount(count: number): void {
    const previousCount = this.health.peerCount;
    this.health.peerCount = count;
    
    // Detect peer loss (was > 0, now 0)
    if (previousCount > 0 && count === 0) {
      console.log('[CONN MGR] Peer lost detected');
      this.onPeerLostCallback?.();
    }
    
    this.notifyHealthChange();
  }

  /**
   * Mark connection as established
   */
  markConnected(): void {
    this.health.isHealthy = true;
    this.health.reconnectAttempts = 0;
    this.health.consecutiveFailures = 0;
    this.health.lastHeartbeatReceived = Date.now();
    this.notifyHealthChange();
  }

  /**
   * Mark connection as disconnected
   */
  markDisconnected(): void {
    this.health.isHealthy = false;
    this.notifyHealthChange();
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnection(): void {
    if (this.health.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[CONN MGR] Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.config.baseDelay * Math.pow(2, this.health.reconnectAttempts),
      this.config.maxDelay
    );
    const jitter = Math.floor(Math.random() * 1000);
    const delay = exponentialDelay + jitter;

    console.log(`[CONN MGR] Scheduling reconnection in ${Math.round(delay / 1000)}s (attempt ${this.health.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.health.reconnectAttempts++;
      this.onReconnectCallback?.();
    }, delay);
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring(): void {
    this.stopHealthMonitoring();
    
    this.healthCheckTimer = setInterval(() => {
      this.checkHealth();
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Check connection health
   */
  private checkHealth(): void {
    const now = Date.now();
    
    // Check heartbeat timeout
    if (this.health.lastHeartbeatReceived > 0) {
      const timeSinceLastHeartbeat = now - this.health.lastHeartbeatReceived;
      
      if (timeSinceLastHeartbeat > this.config.heartbeatTimeout) {
        console.warn(`[CONN MGR] Heartbeat timeout: ${timeSinceLastHeartbeat}ms since last heartbeat`);
        this.recordMissedHeartbeat();
      }
    }
    
    // Check peer presence timeout
    if (this.health.peerCount > 0) {
      // Peer is present, all good
    }
  }

  /**
   * Update message statistics
   */
  updateStats(stats: { messagesSent?: number; messagesReceived?: number }): void {
    if (stats.messagesSent) this.health.messagesSent += stats.messagesSent;
    if (stats.messagesReceived) this.health.messagesReceived += stats.messagesReceived;
  }

  /**
   * Get current health status
   */
  getHealth(): ConnectionHealth {
    return { ...this.health };
  }

  /**
   * Check if connection should attempt recovery
   */
  shouldAttemptRecovery(): boolean {
    return this.health.reconnectAttempts < this.config.maxReconnectAttempts;
  }

  /**
   * Reset connection state (call after successful reconnection)
   */
  reset(): void {
    this.health.reconnectAttempts = 0;
    this.health.consecutiveFailures = 0;
    this.health.missedHeartbeats = 0;
    this.health.isHealthy = true;
    this.health.lastHeartbeatReceived = Date.now();
    this.notifyHealthChange();
  }

  /**
   * Set callback for reconnection attempts
   */
  onReconnect(callback: () => void): void {
    this.onReconnectCallback = callback;
  }

  /**
   * Set callback for health status changes
   */
  onHealthChange(callback: (health: ConnectionHealth) => void): void {
    this.onHealthChangeCallback = callback;
  }

  /**
   * Set callback for peer loss detection
   */
  onPeerLost(callback: () => void): void {
    this.onPeerLostCallback = callback;
  }

  private notifyHealthChange(): void {
    this.onHealthChangeCallback?.({ ...this.health });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopHealthMonitoring();
    this.onReconnectCallback = null;
    this.onHealthChangeCallback = null;
    this.onPeerLostCallback = null;
  }
}

// Singleton instance for app-wide connection management
let globalConnectionManager: SyncConnectionManager | null = null;

export function getGlobalConnectionManager(): SyncConnectionManager {
  if (!globalConnectionManager) {
    globalConnectionManager = new SyncConnectionManager();
  }
  return globalConnectionManager;
}

export function resetGlobalConnectionManager(): void {
  globalConnectionManager?.destroy();
  globalConnectionManager = null;
}
