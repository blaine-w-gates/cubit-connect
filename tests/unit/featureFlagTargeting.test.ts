/**
 * Unit tests for featureFlagTargeting.ts
 *
 * @module featureFlagTargeting.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getTargetingEngine,
  destroyTargetingEngine,
  targeting,
  type UserContext,
} from '@/lib/featureFlagTargeting';

describe('featureFlagTargeting', () => {
  beforeEach(() => {
    destroyTargetingEngine();
  });

  afterEach(() => {
    destroyTargetingEngine();
  });

  // ============================================================================
  // Basic Targeting Tests
  // ============================================================================

  describe('basic targeting', () => {
    it('should create targeting engine', () => {
      const engine = getTargetingEngine();
      expect(engine).toBeDefined();
    });

    it('should evaluate feature for user in percentage', () => {
      const engine = getTargetingEngine();

      engine.setTargeting('TEST_FEATURE', {
        enabled: true,
        rolloutPercentage: 100, // 100% = all users
      });

      const user: UserContext = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      const result = engine.evaluate('TEST_FEATURE', user);
      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('percentage');
    });

    it('should disable feature for user outside percentage', () => {
      const engine = getTargetingEngine();

      engine.setTargeting('TEST_FEATURE', {
        enabled: true,
        rolloutPercentage: 0, // 0% = no users
      });

      const user: UserContext = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      const result = engine.evaluate('TEST_FEATURE', user);
      expect(result.enabled).toBe(false);
    });

    it('should target specific user IDs', () => {
      const engine = getTargetingEngine();

      engine.setTargeting('BETA_FEATURE', {
        enabled: true,
        rolloutPercentage: 0,
        segments: [
          {
            userIds: ['beta-user-1', 'beta-user-2'],
          },
        ],
      });

      const betaUser: UserContext = {
        userId: 'beta-user-1',
        email: 'beta@example.com',
      };

      const regularUser: UserContext = {
        userId: 'regular-user',
        email: 'regular@example.com',
      };

      expect(engine.evaluate('BETA_FEATURE', betaUser).enabled).toBe(true);
      expect(engine.evaluate('BETA_FEATURE', regularUser).enabled).toBe(false);
    });

    it('should target by email domain', () => {
      const engine = getTargetingEngine();

      engine.setTargeting('ENTERPRISE_FEATURE', {
        enabled: true,
        rolloutPercentage: 0,
        segments: [
          {
            emailDomains: ['company.com', 'enterprise.com'],
          },
        ],
      });

      const enterpriseUser: UserContext = {
        userId: 'user-1',
        email: 'user@company.com',
      };

      const regularUser: UserContext = {
        userId: 'user-2',
        email: 'user@gmail.com',
      };

      expect(engine.evaluate('ENTERPRISE_FEATURE', enterpriseUser).enabled).toBe(true);
      expect(engine.evaluate('ENTERPRISE_FEATURE', regularUser).enabled).toBe(false);
    });

    it('should target beta users', () => {
      const engine = getTargetingEngine();

      engine.setTargeting('EXPERIMENTAL', {
        enabled: true,
        rolloutPercentage: 0,
        segments: [
          {
            betaUsers: true,
          },
        ],
      });

      const betaUser: UserContext = {
        userId: 'user-1',
        email: 'beta@example.com',
        isBetaUser: true,
      };

      const regularUser: UserContext = {
        userId: 'user-2',
        email: 'regular@example.com',
        isBetaUser: false,
      };

      expect(engine.evaluate('EXPERIMENTAL', betaUser).enabled).toBe(true);
      expect(engine.evaluate('EXPERIMENTAL', regularUser).enabled).toBe(false);
    });
  });

  // ============================================================================
  // Date Constraint Tests
  // ============================================================================

  describe('date constraints', () => {
    it('should respect start date', () => {
      const engine = getTargetingEngine();
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow

      engine.setTargeting('FUTURE_FEATURE', {
        enabled: true,
        rolloutPercentage: 100,
        startDate: futureDate,
      });

      const user: UserContext = {
        userId: 'user-1',
        email: 'test@example.com',
      };

      const result = engine.evaluate('FUTURE_FEATURE', user);
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('date');
    });

    it('should respect end date', () => {
      const engine = getTargetingEngine();
      const pastDate = new Date(Date.now() - 86400000); // Yesterday

      engine.setTargeting('EXPIRED_FEATURE', {
        enabled: true,
        rolloutPercentage: 100,
        endDate: pastDate,
      });

      const user: UserContext = {
        userId: 'user-1',
        email: 'test@example.com',
      };

      const result = engine.evaluate('EXPIRED_FEATURE', user);
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('date');
    });
  });

  // ============================================================================
  // Convenience API Tests
  // ============================================================================

  describe('convenience API', () => {
    it('should set Supabase sync targeting', () => {
      targeting.setSupabaseSyncTargeting({
        rolloutPercentage: 50,
      });

      const engine = getTargetingEngine();
      const config = engine.getTargeting('USE_SUPABASE_SYNC');

      expect(config?.rolloutPercentage).toBe(50);
      expect(config?.enabled).toBe(true);
    });

    it('should check if user should use Supabase sync', () => {
      targeting.setSupabaseSyncTargeting({
        rolloutPercentage: 100,
      });

      const user: UserContext = {
        userId: 'user-1',
        email: 'test@example.com',
      };

      const result = targeting.shouldUseSupabaseSync(user);
      expect(result.enabled).toBe(true);
    });

    it('should enable for specific users', () => {
      targeting.setSupabaseSyncTargeting({
        rolloutPercentage: 0,
      });

      targeting.enableForUsers(['vip-user-1', 'vip-user-2']);

      const vipUser: UserContext = {
        userId: 'vip-user-1',
        email: 'vip@example.com',
      };

      const result = targeting.shouldUseSupabaseSync(vipUser);
      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('user_id');
    });

    it('should set rollout percentage', () => {
      // Ensure targeting is set first
      targeting.setSupabaseSyncTargeting({
        enabled: true,
        rolloutPercentage: 10,
      });

      targeting.setRolloutPercentage(75);

      const engine = getTargetingEngine();
      const config = engine.getTargeting('USE_SUPABASE_SYNC');
      expect(config?.rolloutPercentage).toBe(75);
      expect(config?.enabled).toBe(true);
    });
  });

  // ============================================================================
  // Stats Tests
  // ============================================================================

  describe('statistics', () => {
    it('should return targeting stats', () => {
      const engine = getTargetingEngine();

      engine.setTargeting('FEATURE_1', {
        enabled: true,
        rolloutPercentage: 50,
      });

      engine.setTargeting('FEATURE_2', {
        enabled: false,
        rolloutPercentage: 100,
      });

      const stats = engine.getStats();
      expect(stats.totalFlags).toBe(2);
      expect(stats.enabledFlags).toBe(1);
      expect(stats.averageRolloutPercentage).toBe(50);
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = getTargetingEngine();
      const instance2 = getTargetingEngine();

      expect(instance1).toBe(instance2);
    });
  });

  // ============================================================================
  // DevTools Tests
  // ============================================================================

  describe('devtools integration', () => {
    it('should expose targeting on window', () => {
      expect(window.__FEATURE_TARGETING__).toBeDefined();
    });

    it('should expose stats function', () => {
      expect(window.__FEATURE_TARGETING_STATS__).toBeDefined();
      expect(typeof window.__FEATURE_TARGETING_STATS__).toBe('function');
    });
  });
});
