/**
 * PrintableReport Component Tests
 *
 * @module PrintableReport.test
 * @component
 */

import { describe, it, expect } from 'vitest';

describe('PrintableReport Component', () => {
  it('should exist and be importable', async () => {
    const mod = await import('@/components/PrintableReport');
    expect(mod).toBeDefined();
    expect(mod.PrintableReport).toBeDefined();
  });

  it('should export a React component', async () => {
    const { PrintableReport } = await import('@/components/PrintableReport');
    // forwardRef returns a special React object (forwardRef render function)
    expect(PrintableReport).toBeDefined();
    expect(typeof PrintableReport === 'function' || typeof PrintableReport === 'object').toBe(true);
    expect(PrintableReport.$$typeof?.toString()).toContain('Symbol');
  });

  it('should be a forwardRef component', async () => {
    const { PrintableReport } = await import('@/components/PrintableReport');
    expect(PrintableReport.$$typeof?.toString()).toContain('Symbol');
  });
});
