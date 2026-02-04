import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GeminiService } from '@/services/gemini';

describe('GeminiService Rate Limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1600000000000));
    // Reset internal state to ensure test isolation
    GeminiService._resetRateLimit();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should enforce rate limit for concurrent calls', async () => {
    const start = Date.now();
    const results: number[] = [];

    const recordCompletion = () => results.push(Date.now());

    // Fire 3 calls "concurrently"
    const p1 = GeminiService.enforceRateLimit().then(recordCompletion);

    // Slight delay to ensure order but still "concurrent" w.r.t rate limit
    await vi.advanceTimersByTimeAsync(10);
    const p2 = GeminiService.enforceRateLimit().then(recordCompletion);

    await vi.advanceTimersByTimeAsync(10);
    const p3 = GeminiService.enforceRateLimit().then(recordCompletion);

    // Run timers forward enough to cover all delays
    // Expected: 0, 2000, 4000. So 5000 is plenty.
    await vi.advanceTimersByTimeAsync(5000);

    await Promise.all([p1, p2, p3]);

    results.sort((a, b) => a - b);

    console.log(
      'Completion times:',
      results.map((t) => t - start),
    );

    expect(results.length).toBe(3);

    // Check gaps
    for (let i = 1; i < results.length; i++) {
      const gap = results[i] - results[i - 1];
      // We expect >= 2000ms.
      // Due to initial 10ms staggering, the gaps might be exactly 2000 or slightly adjusted depending on implementation details.
      // But they should definitely be close to 2000.
      expect(gap).toBeGreaterThanOrEqual(1990); // Allow slight epsilon
    }
  });
});
