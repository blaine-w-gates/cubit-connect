/**
 * Gemini Model Configurability Tests
 *
 * Tests the runtime model tier selection (fast/balanced) via
 * localStorage and environment variables.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Gemini Model Configurability', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should export getGeminiModelTier function', async () => {
    const mod = await import('@/services/gemini');
    expect(mod.getGeminiModelTier).toBeDefined();
    expect(typeof mod.getGeminiModelTier).toBe('function');
  });

  it('should export setGeminiModelTier function', async () => {
    const mod = await import('@/services/gemini');
    expect(mod.setGeminiModelTier).toBeDefined();
    expect(typeof mod.setGeminiModelTier).toBe('function');
  });

  it('should default to fast tier when no localStorage or env var is set', async () => {
    const mod = await import('@/services/gemini');
    expect(mod.getGeminiModelTier()).toBe('fast');
  });

  it('should return fast tier when localStorage is set to fast', async () => {
    localStorage.setItem('cubit_gemini_model', 'fast');
    const mod = await import('@/services/gemini');
    expect(mod.getGeminiModelTier()).toBe('fast');
  });

  it('should return balanced tier when localStorage is set to balanced', async () => {
    localStorage.setItem('cubit_gemini_model', 'balanced');
    const mod = await import('@/services/gemini');
    expect(mod.getGeminiModelTier()).toBe('balanced');
  });

  it('should persist tier to localStorage when setGeminiModelTier is called', async () => {
    const mod = await import('@/services/gemini');
    mod.setGeminiModelTier('balanced');
    expect(localStorage.getItem('cubit_gemini_model')).toBe('balanced');
  });

  it('should update tier immediately after setGeminiModelTier', async () => {
    const mod = await import('@/services/gemini');
    expect(mod.getGeminiModelTier()).toBe('fast');
    mod.setGeminiModelTier('balanced');
    expect(mod.getGeminiModelTier()).toBe('balanced');
  });

  it('should toggle back to fast from balanced', async () => {
    const mod = await import('@/services/gemini');
    mod.setGeminiModelTier('balanced');
    expect(mod.getGeminiModelTier()).toBe('balanced');
    mod.setGeminiModelTier('fast');
    expect(mod.getGeminiModelTier()).toBe('fast');
  });

  it('should default to fast for unknown localStorage values', async () => {
    localStorage.setItem('cubit_gemini_model', 'unknown-value');
    const mod = await import('@/services/gemini');
    expect(mod.getGeminiModelTier()).toBe('fast');
  });
});
