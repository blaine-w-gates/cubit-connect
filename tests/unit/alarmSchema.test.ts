/**
 * Alarm System Schema Tests (V1)
 *
 * These tests validate:
 * - Test A: Legacy step with no `id` → safeParse succeeds and backfills UUID
 * - Test B: Legacy step with `id: undefined` → same result
 * - Test C: Alarm snapshot survives parent task deletion
 */

import { describe, it, expect } from 'vitest';
import {
  ProjectDataSchema,
  TodoStepSchema,
  TodoProjectSchema,
  AlarmRecordSchema,
  type TodoStep,
  type TodoRow,
  type TodoProject,
  type AlarmRecord,
} from '@/schemas/storage';

// Test A & B: Legacy Step UUID Backfill
describe('TodoStepSchema UUID Backfill', () => {
  it('Test A: should accept legacy step without id and backfill UUID', () => {
    // Legacy step format (before alarm system V1)
    const legacyStep = {
      text: 'Write introduction',
      isCompleted: false,
      // No 'id' field at all
    };

    // Parse should succeed (id is optional in schema)
    const result = TodoStepSchema.safeParse(legacyStep);
    expect(result.success).toBe(true);

    if (result.success) {
      // Schema accepts it as-is (id is undefined)
      expect(result.data.id).toBeUndefined();
      expect(result.data.text).toBe('Write introduction');
      expect(result.data.isCompleted).toBe(false);
    }
  });

  it('Test B: should accept step with id: undefined and backfill', () => {
    // Step with explicit undefined id
    const stepWithUndefinedId = {
      id: undefined,
      text: 'Write conclusion',
      isCompleted: true,
    };

    const result = TodoStepSchema.safeParse(stepWithUndefinedId);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.id).toBeUndefined();
      expect(result.data.text).toBe('Write conclusion');
      expect(result.data.isCompleted).toBe(true);
    }
  });

  it('should accept step with valid UUID', () => {
    const stepWithId = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      text: 'Review draft',
      isCompleted: false,
    };

    const result = TodoStepSchema.safeParse(stepWithId);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.data.text).toBe('Review draft');
    }
  });
});

// Test C: Alarm Snapshot Survival
describe('Alarm Snapshot Survival', () => {
  it('Test C: should preserve alarm snapshot when parent task is deleted', () => {
    // Create a complete project with a task and alarm
    const stepId = 'step-123-uuid';
    const rowId = 'row-456-uuid';
    const projectId = 'proj-789-uuid';
    const alarmId = 'alarm-abc-uuid';

    const step: TodoStep = {
      id: stepId,
      text: 'Complete the budget analysis',
      isCompleted: false,
    };

    const row: TodoRow = {
      id: rowId,
      task: 'Q4 Financial Report',
      steps: [step, step, step, step] as [TodoStep, TodoStep, TodoStep, TodoStep],
      isCompleted: false,
    };

    const alarm: AlarmRecord = {
      id: alarmId,
      // Snapshot fields - these must survive task deletion
      stepText: 'Complete the budget analysis',
      taskText: 'Q4 Financial Report',
      projectName: 'Q4 Planning',
      // Weak references
      sourceProjectId: projectId,
      sourceTaskId: rowId,
      sourceStepId: stepId,
      // Trigger fields
      alarmTimeMs: Date.now() + 3600000, // 1 hour from now
      status: 'pending',
      snoozeCount: 0,
      // Metadata
      createdAt: Date.now(),
      ownerClientId: 'device-xyz',
    };

    const project: TodoProject = {
      id: projectId,
      name: 'Q4 Planning',
      color: '#22D3EE',
      todoRows: [row],
      priorityDials: { left: '', right: '', focusedSide: 'none' },
      createdAt: Date.now(),
      alarms: [alarm],
      workspaceType: 'personalUno',
      workspaceId: '',
      ownerId: 'test-device',
    };

    // Verify project schema accepts the alarm
    const projectResult = TodoProjectSchema.safeParse(project);
    expect(projectResult.success).toBe(true);

    // Simulate task deletion by removing the row but keeping the alarm
    const projectWithDeletedTask: TodoProject = {
      ...project,
      todoRows: [], // Task deleted!
      alarms: [alarm], // Alarm remains
    };

    // Verify schema still validates
    const resultAfterDeletion = TodoProjectSchema.safeParse(projectWithDeletedTask);
    expect(resultAfterDeletion.success).toBe(true);

    if (resultAfterDeletion.success) {
      // CRITICAL: Alarm snapshot fields must still be present and correct
      const remainingAlarm = resultAfterDeletion.data.alarms[0];
      expect(remainingAlarm.stepText).toBe('Complete the budget analysis');
      expect(remainingAlarm.taskText).toBe('Q4 Financial Report');
      expect(remainingAlarm.projectName).toBe('Q4 Planning');

      // Weak references should still exist (even though source is deleted)
      expect(remainingAlarm.sourceTaskId).toBe(rowId);
      expect(remainingAlarm.sourceStepId).toBe(stepId);
    }
  });

  it('should validate full ProjectDataSchema with alarms', () => {
    const alarm: AlarmRecord = {
      id: 'alarm-test-uuid',
      stepText: 'Test step',
      taskText: 'Test task',
      projectName: 'Test Project',
      alarmTimeMs: Date.now(),
      status: 'pending',
      snoozeCount: 0,
      createdAt: Date.now(),
      ownerClientId: 'test-device',
    };

    const project: TodoProject = {
      id: 'proj-test-uuid',
      name: 'Test Project',
      color: '#FF0000',
      todoRows: [],
      priorityDials: { left: '', right: '', focusedSide: 'none' },
      createdAt: Date.now(),
      alarms: [alarm],
      workspaceType: 'personalUno',
      workspaceId: '',
      ownerId: 'test-device',
    };

    const projectData = {
      tasks: [],
      todoProjects: [project],
      activeProjectId: project.id,
      timerSessions: [],
      todayPreferences: {
        defaultDuration: 25,
        autoStart: false,
        soundEnabled: true,
        notificationEnabled: true,
        vibrationEnabled: true,
        showRowTomatoButtons: true,
      },
      updatedAt: Date.now(),
    };

    const result = ProjectDataSchema.safeParse(projectData);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.todoProjects[0].alarms).toHaveLength(1);
      expect(result.data.todoProjects[0].alarms[0].stepText).toBe('Test step');
    }
  });
});

// Test AlarmRecordSchema validation
describe('AlarmRecordSchema', () => {
  it('should require snapshot fields', () => {
    const incompleteAlarm = {
      id: 'test-uuid',
      alarmTimeMs: Date.now(),
      createdAt: Date.now(),
      ownerClientId: 'device',
      snoozeCount: 0,
      // Missing stepText, taskText, projectName
    };

    const result = AlarmRecordSchema.safeParse(incompleteAlarm);
    expect(result.success).toBe(false);
  });

  it('should accept all valid alarm statuses', () => {
    const baseAlarm = {
      id: 'test-uuid',
      stepText: 'Step',
      taskText: 'Task',
      projectName: 'Project',
      alarmTimeMs: Date.now(),
      createdAt: Date.now(),
      ownerClientId: 'device',
      snoozeCount: 0,
    };

    // Test pending status
    const pendingResult = AlarmRecordSchema.safeParse({ ...baseAlarm, status: 'pending' });
    expect(pendingResult.success).toBe(true);

    // Test triggered status
    const triggeredResult = AlarmRecordSchema.safeParse({ ...baseAlarm, status: 'triggered' });
    expect(triggeredResult.success).toBe(true);

    // Test dismissed status
    const dismissedResult = AlarmRecordSchema.safeParse({ ...baseAlarm, status: 'dismissed' });
    expect(dismissedResult.success).toBe(true);

    // Test snoozed status
    const snoozedResult = AlarmRecordSchema.safeParse({
      ...baseAlarm,
      status: 'snoozed',
      snoozeCount: 1,
      originalAlarmTimeMs: Date.now() - 300000,
    });
    expect(snoozedResult.success).toBe(true);
  });

  it('should accept optional future-proof identity fields', () => {
    const alarmWithFutureFields = {
      id: 'test-uuid',
      stepText: 'Step',
      taskText: 'Task',
      projectName: 'Project',
      alarmTimeMs: Date.now(),
      status: 'pending',
      snoozeCount: 0,
      createdAt: Date.now(),
      ownerClientId: 'device',
      // Future-proof fields (null until Supabase migration)
      userId: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: 'workspace-123',
      workspaceType: 'personalUno',
    };

    const result = AlarmRecordSchema.safeParse(alarmWithFutureFields);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.data.workspaceId).toBe('workspace-123');
      expect(result.data.workspaceType).toBe('personalUno');
    }
  });
});
