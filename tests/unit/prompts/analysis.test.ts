/**
 * Analysis Prompts Tests
 *
 * @module prompts/analysis.test
 * @description Tests for analysis prompt functions
 */

import { describe, it, expect } from 'vitest';
import {
  transcriptAnalysisPrompt,
  subStepsPrompt,
  testPrompt,
} from '@/prompts/analysis';

describe('transcriptAnalysisPrompt', () => {
  it('should be a function', () => {
    expect(typeof transcriptAnalysisPrompt).toBe('function');
  });

  it('should return a string', () => {
    const result = transcriptAnalysisPrompt('test transcript', 'video');
    expect(typeof result).toBe('string');
  });

  it('should include transcript content', () => {
    const transcript = 'This is a test transcript about programming.';
    const result = transcriptAnalysisPrompt(transcript, 'video');
    expect(result).toContain('test transcript');
  });

  it('should truncate transcript to 30000 chars', () => {
    const longTranscript = 'a'.repeat(50000);
    const result = transcriptAnalysisPrompt(longTranscript, 'video');
    expect(result.length).toBeLessThan(35000); // Template + 30k chars
  });

  it('should include VIDEO MODE for video type', () => {
    const result = transcriptAnalysisPrompt('test', 'video');
    expect(result).toContain('VIDEO MODE');
  });

  it('should include TEXT MODE for text type', () => {
    const result = transcriptAnalysisPrompt('test', 'text');
    expect(result).toContain('TEXT MODE');
  });

  it('should include video duration constraint when provided', () => {
    const result = transcriptAnalysisPrompt('test', 'video', 300);
    expect(result).toContain('300');
    expect(result).toContain('CONSTRAINT');
  });
});

describe('subStepsPrompt', () => {
  it('should be a function', () => {
    expect(typeof subStepsPrompt).toBe('function');
  });

  it('should return a string', () => {
    const result = subStepsPrompt('test instruction');
    expect(typeof result).toBe('string');
  });

  it('should include instruction', () => {
    const instruction = 'Create a React component';
    const result = subStepsPrompt(instruction);
    expect(result).toContain(instruction);
  });

  it('should include transcript context when provided', () => {
    const transcript = 'Global context about React';
    const result = subStepsPrompt('test', transcript);
    expect(result).toContain('Global context');
    expect(result).toContain('React');
  });

  it('should truncate transcript to 5000 chars', () => {
    const longTranscript = 'a'.repeat(10000);
    const result = subStepsPrompt('test', longTranscript);
    expect(result.length).toBeLessThan(7000); // Template + ~5k chars
  });

  it('should include neighbor context when provided', () => {
    const neighbors = 'Previous task, Next task';
    const result = subStepsPrompt('test', '', neighbors);
    expect(result).toContain(neighbors);
  });
});

describe('testPrompt', () => {
  it('should be a function', () => {
    expect(typeof testPrompt).toBe('function');
  });

  it('should return a string', () => {
    const result = testPrompt();
    expect(typeof result).toBe('string');
  });

  it('should return expected test prompt', () => {
    const result = testPrompt();
    expect(result).toContain('JavaScript learning tasks');
    expect(result).toContain('JSON array');
  });
});
