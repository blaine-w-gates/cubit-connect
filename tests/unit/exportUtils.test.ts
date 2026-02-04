import { describe, it, expect } from 'vitest';
import { getSafeFilename, generateMarkdown } from '@/utils/exportUtils';

describe('getSafeFilename', () => {
  it('should replace special characters with underscores', () => {
    // getSafeFilename now returns the name WITHOUT extension by default (utility logic changed)
    // The extension is added in the download function or consumer.
    expect(getSafeFilename('My Plan!')).toBe('my_plan');
  });

  it('should lower case input', () => {
    expect(getSafeFilename('TeSt')).toBe('test');
  });

  it('should trim leading/trailing underscores', () => {
    // Implementation check: `replace(/^_+|_+$/g, '')`
    expect(getSafeFilename('_test_')).toBe('test');
  });
});

describe('generateMarkdown', () => {
  it('should generate basic markdown', () => {
    const tasks = [
      {
        id: '1',
        task_name: 'Task 1',
        timestamp_seconds: 0,
        description: 'Desc 1',
        screenshot_base64: '',
        sub_steps: [],
      },
    ];
    const md = generateMarkdown(tasks, 'My Title');
    expect(md).toContain('# My Title');
    expect(md).toContain('## Task 1');
    expect(md).toContain('> Desc 1');
  });

  it('should format timestamps correctly', () => {
    const tasks = [
      {
        id: '1',
        task_name: 'Task 1',
        timestamp_seconds: 65, // 01:05
        description: '',
        screenshot_base64: '',
        sub_steps: [],
      },
    ];
    const md = generateMarkdown(tasks);
    expect(md).toContain('(01:05)');
  });
});
