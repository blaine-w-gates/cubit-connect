/**
 * Feature Flag Targeting
 *
 * User segmentation for gradual rollouts and A/B testing.
 * Enables percentage-based feature availability.
 *
 * @module featureFlagTargeting
 * @version 1.0.0
 */

import { emitTelemetry } from './featureFlags';

// ============================================================================
// TYPES
// ============================================================================

/**
 * User segment criteria
 */
export interface UserSegment {
  percentage?: number; // 0-100, percentage of users
  userIds?: string[]; // Specific user IDs
  emailDomains?: string[]; // Email domain whitelist
  createdAfter?: Date; // Users created after date
  betaUsers?: boolean; // Beta flag on user profile
}

/**
 * Targeting configuration for a feature
 */
export interface FeatureTargeting {
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  segments?: UserSegment[];
  startDate?: Date;
  endDate?: Date;
  description?: string;
}

/**
 * User context for targeting evaluation
 */
export interface UserContext {
  userId: string;
  email: string;
  createdAt?: Date;
  isBetaUser?: boolean;
  attributes?: Record<string, unknown>;
}

/**
 * Targeting result
 */
export interface TargetingResult {
  enabled: boolean;
  reason: 'percentage' | 'user_id' | 'email_domain' | 'beta' | 'date' | 'disabled' | 'not_in_segment';
  segment?: string;
}

// ============================================================================
// TARGETING ENGINE
// ============================================================================

class FeatureFlagTargetingEngine {
  private targetingMap: Map<string, FeatureTargeting> = new Map();

  /**
   * Set targeting for a feature flag
   */
  setTargeting(flagKey: string, targeting: FeatureTargeting): void {
    this.targetingMap.set(flagKey, targeting);

    emitTelemetry('flag_toggled', {
      value: targeting.enabled,
      context: {
        flagKey,
        rolloutPercentage: targeting.rolloutPercentage,
        hasSegments: !!targeting.segments?.length,
      },
    });
  }

  /**
   * Get targeting for a feature flag
   */
  getTargeting(flagKey: string): FeatureTargeting | undefined {
    return this.targetingMap.get(flagKey);
  }

  /**
   * Evaluate if user should have feature enabled
   */
  evaluate(flagKey: string, user: UserContext): TargetingResult {
    const targeting = this.targetingMap.get(flagKey);

    if (!targeting) {
      return { enabled: false, reason: 'disabled' };
    }

    if (!targeting.enabled) {
      return { enabled: false, reason: 'disabled' };
    }

    // Check date constraints
    const now = new Date();
    if (targeting.startDate && now < targeting.startDate) {
      return { enabled: false, reason: 'date' };
    }
    if (targeting.endDate && now > targeting.endDate) {
      return { enabled: false, reason: 'date' };
    }

    // Check segments first
    if (targeting.segments && targeting.segments.length > 0) {
      for (const segment of targeting.segments) {
        const result = this.evaluateSegment(segment, user);
        if (result.enabled) {
          return { enabled: true, reason: result.reason, segment: JSON.stringify(segment) };
        }
      }
    }

    // Fall back to percentage-based rollout
    const isInRollout = this.isUserInPercentage(user.userId, targeting.rolloutPercentage);

    if (isInRollout) {
      return { enabled: true, reason: 'percentage' };
    }

    return { enabled: false, reason: 'not_in_segment' };
  }

  /**
   * Evaluate a single segment
   */
  private evaluateSegment(segment: UserSegment, user: UserContext): { enabled: boolean; reason: TargetingResult['reason'] } {
    // Check specific user IDs
    if (segment.userIds?.includes(user.userId)) {
      return { enabled: true, reason: 'user_id' };
    }

    // Check beta users
    if (segment.betaUsers && user.isBetaUser) {
      return { enabled: true, reason: 'beta' };
    }

    // Check email domains
    if (segment.emailDomains) {
      const userDomain = user.email.split('@')[1];
      if (segment.emailDomains.includes(userDomain)) {
        return { enabled: true, reason: 'email_domain' };
      }
    }

    // Check user creation date
    if (segment.createdAfter && user.createdAt) {
      if (user.createdAt >= segment.createdAfter) {
        return { enabled: true, reason: 'date' };
      }
    }

    // Check percentage within segment
    if (segment.percentage !== undefined) {
      const isInSegment = this.isUserInPercentage(user.userId, segment.percentage);
      if (isInSegment) {
        return { enabled: true, reason: 'percentage' };
      }
    }

    return { enabled: false, reason: 'not_in_segment' };
  }

  /**
   * Check if user is in percentage rollout
   * Uses consistent hashing for stable results
   */
  private isUserInPercentage(userId: string, percentage: number): boolean {
    // Simple hash function for consistent results
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash + char) & 0xffffffff;
    }

    // Normalize to 0-100
    const normalized = Math.abs(hash) % 100;
    return normalized < percentage;
  }

  /**
   * Get rollout statistics
   */
  getStats(): {
    totalFlags: number;
    enabledFlags: number;
    averageRolloutPercentage: number;
  } {
    const flags = Array.from(this.targetingMap.values());
    const enabled = flags.filter((f) => f.enabled);

    const avgPercentage =
      enabled.length > 0
        ? enabled.reduce((sum, f) => sum + f.rolloutPercentage, 0) / enabled.length
        : 0;

    return {
      totalFlags: flags.length,
      enabledFlags: enabled.length,
      averageRolloutPercentage: avgPercentage,
    };
  }

  /**
   * Export all targeting configurations
   */
  export(): Record<string, FeatureTargeting> {
    return Object.fromEntries(this.targetingMap);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let targetingEngineInstance: FeatureFlagTargetingEngine | null = null;

/**
 * Get or create targeting engine
 */
export function getTargetingEngine(): FeatureFlagTargetingEngine {
  if (!targetingEngineInstance) {
    targetingEngineInstance = new FeatureFlagTargetingEngine();
  }
  return targetingEngineInstance;
}

/**
 * Destroy targeting engine (for testing)
 */
export function destroyTargetingEngine(): void {
  targetingEngineInstance = null;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const targeting = {
  /**
   * Set targeting for Supabase sync feature
   */
  setSupabaseSyncTargeting(config: Partial<FeatureTargeting>): void {
    const targeting = getTargetingEngine();

    targeting.setTargeting('USE_SUPABASE_SYNC', {
      enabled: true,
      rolloutPercentage: 100,
      ...config,
    });
  },

  /**
   * Check if current user should use Supabase sync
   */
  shouldUseSupabaseSync(user: UserContext): TargetingResult {
    return getTargetingEngine().evaluate('USE_SUPABASE_SYNC', user);
  },

  /**
   * Enable for specific users (override)
   */
  enableForUsers(userIds: string[]): void {
    const engine = getTargetingEngine();
    const current = engine.getTargeting('USE_SUPABASE_SYNC');

    engine.setTargeting('USE_SUPABASE_SYNC', {
      enabled: true,
      rolloutPercentage: 0, // Only targeted users
      segments: [
        {
          userIds,
        },
      ],
      ...current,
    });
  },

  /**
   * Set percentage rollout
   */
  setRolloutPercentage(percentage: number): void {
    const engine = getTargetingEngine();
    const current = engine.getTargeting('USE_SUPABASE_SYNC');

    engine.setTargeting('USE_SUPABASE_SYNC', {
      ...current,
      enabled: true,
      rolloutPercentage: percentage,
    });
  },
};

// ============================================================================
// GLOBAL ACCESS
// ============================================================================

declare global {
  interface Window {
    __FEATURE_TARGETING__?: FeatureFlagTargetingEngine;
    __FEATURE_TARGETING_STATS__?: () => {
      totalFlags: number;
      enabledFlags: number;
      averageRolloutPercentage: number;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__FEATURE_TARGETING__ = getTargetingEngine();
  window.__FEATURE_TARGETING_STATS__ = () => getTargetingEngine().getStats();
}
