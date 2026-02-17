import { describe, it, expect } from 'vitest';
import { getSafeFilename, generateMarkdown } from '@/utils/exportUtils';
import { TaskItem } from '@/services/storage';

describe('getSafeFilename', () => {
  it('should replace special characters with underscores', () => {
    expect(getSafeFilename('My Plan!')).toBe('my_plan');
  });

  it('should lower case input', () => {
    expect(getSafeFilename('TeSt')).toBe('test');
  });

  it('should trim leading/trailing underscores', () => {
    expect(getSafeFilename('_test_')).toBe('test');
  });
});

describe('generateMarkdown', () => {
  it('should generate basic markdown', () => {
    const tasks: TaskItem[] = [
      {
        id: '1',
        task_name: 'Task 1',
        timestamp_seconds: 0,
        description: 'Desc 1',
        screenshot_base64: '',
        isExpanded: false,
        sub_steps: [],
      },
    ];
    const md = generateMarkdown(tasks, 'My Title');
    expect(md).toContain('# My Title');
    expect(md).toContain('## Task 1');
    expect(md).toContain('> Desc 1');
  });

  it('should format timestamps correctly', () => {
    const tasks: TaskItem[] = [
      {
        id: '1',
        task_name: 'Task 1',
        timestamp_seconds: 65, // 01:05
        description: '',
        screenshot_base64: '',
        isExpanded: false,
        sub_steps: [],
      },
    ];
    const md = generateMarkdown(tasks);
    expect(md).toContain('(01:05)');
  });

  it('should handle recursive nesting', () => {
    const tasks: TaskItem[] = [
      {
        id: '1',
        task_name: 'Root',
        timestamp_seconds: 0,
        description: '',
        screenshot_base64: '',
        isExpanded: false,
        sub_steps: [
          {
            id: 's1',
            text: 'L1',
            sub_steps: [
              {
                id: 's2',
                text: 'L2',
                sub_steps: ['L3']
              }
            ]
          }
        ]
      }
    ];
    const md = generateMarkdown(tasks);
    expect(md).toContain('1. [ ] L1');
    expect(md).toContain('    - L2');
    expect(md).toContain('        - L3');
  });
});
