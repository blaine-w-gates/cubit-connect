/**
 * Scout Prompts Tests
 *
 * @module prompts/scout.test
 * @description Tests for scout prompt functions
 */

import { describe, it, expect } from 'vitest';
import { searchQueriesPrompt } from '@/prompts/scout';

describe('searchQueriesPrompt', () => {
  it('should be a function', () => {
    expect(typeof searchQueriesPrompt).toBe('function');
  });

  it('should return a string', () => {
    const result = searchQueriesPrompt('test topic');
    expect(typeof result).toBe('string');
  });

  it('should include the topic', () => {
    const topic = 'sourdough baking';
    const result = searchQueriesPrompt(topic);
    expect(result).toContain(topic);
  });

  it('should include all 5 platforms', () => {
    const result = searchQueriesPrompt('test');
    expect(result).toContain('Instagram');
    expect(result).toContain('Reddit');
    expect(result).toContain('TikTok');
    expect(result).toContain('LinkedIn');
    expect(result).toContain('Facebook');
  });

  it('should specify exactly 10 queries', () => {
    const result = searchQueriesPrompt('test');
    expect(result).toContain('10 queries');
    expect(result).toContain('Exactly 10');
  });

  it('should include JSON array format', () => {
    const result = searchQueriesPrompt('test');
    expect(result).toContain('JSON Array');
  });

  it('should include language detection rule', () => {
    const result = searchQueriesPrompt('test');
    expect(result).toContain('CRITICAL LANGUAGE RULE');
  });

  it('should include under 4 words rule', () => {
    const result = searchQueriesPrompt('test');
    expect(result).toContain('UNDER 4 WORDS');
  });
});
