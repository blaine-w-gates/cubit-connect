/**
 * Prompts Index Tests
 *
 * @module prompts/index.test
 * @description Tests for prompt barrel exports
 */

import { describe, it, expect } from 'vitest';

describe('Prompts Index', () => {
  it('should export all prompt functions', async () => {
    const index = await import('@/prompts');

    expect(index).toBeDefined();
    expect(typeof index.transcriptAnalysisPrompt).toBe('function');
    expect(typeof index.subStepsPrompt).toBe('function');
    expect(typeof index.searchQueriesPrompt).toBe('function');
    expect(typeof index.testPrompt).toBe('function');
  });

  it('should be importable', async () => {
    const index = await import('@/prompts');
    expect(index).toBeDefined();
  });
});
