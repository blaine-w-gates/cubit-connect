/**
 * SettingsDialog Component Tests
 *
 * @module SettingsDialog.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('SettingsDialog Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/SettingsDialog');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('should export a React component', async () => {
    const { default: SettingsDialog } = await import('@/components/SettingsDialog');
    expect(typeof SettingsDialog).toBe('function');
  });

  it('should have component name', async () => {
    const { default: SettingsDialog } = await import('@/components/SettingsDialog');
    expect(SettingsDialog.name).toBe('SettingsDialog');
  });
});
