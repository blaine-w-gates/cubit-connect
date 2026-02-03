import { describe, it, expect } from 'vitest';
import { repairJson } from '@/lib/validation';

describe('repairJson', () => {
  it('should return empty array for empty input', () => {
    expect(repairJson('')).toBe('[]');
  });

  it('should strip markdown code blocks', () => {
    const input = '```json\n[{"id": 1}]\n```';
    expect(repairJson(input)).toBe('[{"id": 1}]');
  });

  it('should extract array from text', () => {
    const input = 'Here is the data: [{"id": 1}] hope it helps.';
    expect(repairJson(input)).toBe('[{"id": 1}]');
  });

  it('should fix timestamp format MM:SS to seconds', () => {
    const input = '[{"timestamp_seconds": 1:30.5}]';
    // 1*60 + 30.5 = 90.5
    expect(repairJson(input)).toBe('[{"timestamp_seconds": 90.5}]');
  });

  it('should fix timestamp format with quotes', () => {
    const input = '[{"timestamp_seconds": "02:00"}]';
    // 2*60 = 120
    expect(repairJson(input)).toBe('[{"timestamp_seconds": 120}]');
  });

  it('should handle multiple timestamp fixes', () => {
    const input = '[{"t": 1:00}, {"t": 2:00}]'.replace(/"t"/g, '"timestamp_seconds"');
    // 60 and 120
    const result = repairJson(input);
    expect(result).toContain('60');
    expect(result).toContain('120');
  });
});
