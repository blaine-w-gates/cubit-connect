import { z } from 'zod';

// --- Recursive Step Schema ---
// We need to define the type explicitly to avoid Zod 'any' inference in lazy recursion
export interface CubitStep {
  id: string;
  text: string;
  isCompleted?: boolean;
  sub_steps?: (string | CubitStep)[];
}

export const CubitStepSchema: z.ZodType<CubitStep> = z.lazy(() =>
  z.object({
    id: z.string(),
    text: z.string(),
    isCompleted: z.boolean().optional(),
    // sub_steps can be an array of strings OR an array of CubitStep objects
    sub_steps: z
      .union([z.array(z.string()), z.array(CubitStepSchema)])
      .optional()
      .default([]),
  }),
);

export const TaskItemSchema = z.object({
  id: z.string(),
  task_name: z.string(),
  timestamp_seconds: z.number(),
  description: z.string(),
  screenshot_base64: z.string().optional().default(''), // Handle legacy missing fields
  isExpanded: z.boolean().optional().default(false), // Persistent UI state for auto-expansion
  sub_steps: z.array(CubitStepSchema).optional().default([]),
});

// --- Workspace Metadata (ADR-001) ---
// Define this BEFORE schemas that use it to avoid circular reference
export const WorkspaceTypeEnum = z.enum(['personalUno', 'personalMulti', 'teamWorkspace']);
export type WorkspaceType = z.infer<typeof WorkspaceTypeEnum>;

// --- To-Do Page Schemas ---
export const TodoStepSchema = z.object({
  id: z.string().optional(), // UUID - backfilled on load for legacy data
  text: z.string(),
  isCompleted: z.boolean().default(false),
});

export const TodoRowSchema = z.object({
  id: z.string(),
  task: z.string(),
  steps: z.tuple([TodoStepSchema, TodoStepSchema, TodoStepSchema, TodoStepSchema]),  // Fixed 4-step grid
  isCompleted: z.boolean().optional().default(false),
  sourceStepId: z.string().optional(),  // Tracks Deep Dive origin (for future linking)
  orderKey: z.string().optional(), // Used for Y.Map Fractional Indexing sorting
  // Future-proofing for Supabase account migration (V2)
  userId: z.string().uuid().optional(),
  workspaceId: z.string().optional(),
  workspaceType: WorkspaceTypeEnum.optional(),
});

export const PriorityDialsSchema = z.object({
  left: z.string(),
  right: z.string(),
  focusedSide: z.enum(['left', 'right', 'none']).optional().default('none'),
});

// --- Alarm System Schema (V1/V2) ---
// MUST be defined BEFORE TodoProjectSchema since TodoProjectSchema references it
// Alarms are stored as "snapshots" (copied text) so they survive task deletion.
// V1 Limitation: Alarms fire only when app tab is active (setInterval throttles in background).
// V2: Added recurrence support for habit tracking.
export const AlarmRecurrenceSchema = z.object({
  type: z.enum(['once', 'daily', 'weekdays']).default('once'),
  // For 'weekdays', stores which days (0=Sun, 1=Mon, ..., 6=Sat)
  weekdays: z.array(z.number().min(0).max(6)).optional(),
  // Tracks if this alarm instance is part of a recurring series
  isRecurringInstance: z.boolean().default(false),
  // Original alarm ID that started this recurring chain
  parentAlarmId: z.string().optional(),
});

export const AlarmRecordSchema = z.object({
  id: z.string(), // UUID
  // Snapshot fields - survive task deletion
  stepText: z.string(),
  taskText: z.string(),
  projectName: z.string(),
  // Weak references to source (nullable if source deleted)
  sourceProjectId: z.string().optional(),
  sourceTaskId: z.string().optional(),
  sourceStepId: z.string().optional(), // Uses step.id (backfilled UUID)
  // Trigger fields
  alarmTimeMs: z.number(), // Unix timestamp
  status: z.enum(['pending', 'triggered', 'dismissed', 'snoozed']).default('pending'),
  // Snooze tracking
  snoozeCount: z.number().default(0), // Track how many times snoozed
  originalAlarmTimeMs: z.number().optional(), // Original time before snoozes
  // Recurrence (V2)
  recurrence: AlarmRecurrenceSchema.optional(),
  // Metadata
  createdAt: z.number(),
  // Identity anchors - ownerClientId required now, userId for V2 Supabase migration
  ownerClientId: z.string(),
  userId: z.string().uuid().optional(), // Null until Supabase auth implemented
  workspaceId: z.string().optional(), // Null until team workspaces
  workspaceType: WorkspaceTypeEnum.optional(),
});

// --- Todo Project Schema (Book Tab) ---
// Each project has its own todoRows + priorityDials, identified by a color-coded tab.
export const TodoProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),                        // Hex color for the tab
  todoRows: z.array(TodoRowSchema).default([]),
  priorityDials: PriorityDialsSchema.default({ left: '', right: '', focusedSide: 'none' }),
  createdAt: z.number(),
  orderKey: z.string().optional(),
  // Workspace metadata (ADR-001)
  workspaceType: WorkspaceTypeEnum.default('personalUno'),
  workspaceId: z.string().default(''),
  ownerId: z.string().default(''),
  teamId: z.string().optional(),
  objectiveId: z.string().optional(),
  // Alarm system (V1) - stored at project level for Yjs sync
  alarms: z.array(AlarmRecordSchema).default([]),
});

// --- Timer Session Schema (Today Page / Pomodoro) ---
export const TimerInterruptionSchema = z.object({
  pausedAt: z.number(),
  resumedAt: z.number().optional(),
});

export const BreakSessionSchema = z.object({
  startedAt: z.number().optional(),
  durationMs: z.number().default(5 * 60 * 1000),
  completed: z.boolean().default(false),
});

export const TimerSessionSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  projectId: z.string(),
  dialSource: z.enum(['left', 'right']),
  // DISCRETE STATUS - NOT DERIVED
  status: z.enum(['idle', 'running', 'paused', 'completed', 'abandoned']),
  // TIMESTAMP MATH COMPONENTS
  startedAt: z.number(),
  endedAt: z.number().optional(),
  durationMs: z.number().default(25 * 60 * 1000),
  // PAUSE/RESUME ACCUMULATOR
  totalPausedMs: z.number().default(0),
  lastPausedAt: z.number().optional(),
  // TEMPORAL INTERRUPTION ARRAY (replaces simple count)
  interruptions: z.array(TimerInterruptionSchema).default([]),
  // AWARENESS: Who owns the active execution
  ownerClientId: z.string(),
  ownerTabId: z.string(),
  ownerDeviceId: z.string(),
  // BREAK SESSION (Fogg cognitive load reset)
  breakSession: BreakSessionSchema.optional(),
  completed: z.boolean().default(false),
  // Future-proofing for Supabase account migration (V2)
  userId: z.string().uuid().optional(),
  workspaceId: z.string().optional(),
  workspaceType: WorkspaceTypeEnum.optional(),
});

// --- Today Page Preferences ---
export const TodayPreferencesSchema = z.object({
  defaultDuration: z.number().default(25),
  autoStart: z.boolean().default(false),
  soundEnabled: z.boolean().default(true),
  soundVolume: z.number().min(0).max(1).default(1), // 0.0 to 1.0 (V2)
  notificationEnabled: z.boolean().default(true),
  vibrationEnabled: z.boolean().default(true),
  showRowTomatoButtons: z.boolean().default(true),
});

export const ProjectDataSchema = z.object({
  tasks: z.array(TaskItemSchema),
  transcript: z.string().optional(),
  scoutResults: z.array(z.string()).optional(),
  projectType: z.enum(['video', 'text', 'scout']).optional().nullable(),
  projectTitle: z.string().optional(),
  scoutTopic: z.string().optional(),
  scoutPlatform: z.string().optional(),
  scoutHistory: z.array(z.string()).optional(),
  inputMode: z.enum(['video', 'text', 'scout']).optional().nullable(),
  // LEGACY: Flat todoRows/priorityDials (kept for migration from old format)
  todoRows: z.array(TodoRowSchema).optional().default([]),
  priorityDials: PriorityDialsSchema.optional().default({ left: '', right: '', focusedSide: 'none' }),
  // NEW: Project-scoped todo data (Book Tabs)
  todoProjects: z.array(TodoProjectSchema).optional().default([]),
  activeProjectId: z.string().optional().nullable(),
  yjsState: z.custom<Uint8Array>((val: unknown) => val instanceof Uint8Array || (val !== null && typeof val === 'object' && 'byteLength' in val && typeof (val as { byteLength: unknown }).byteLength === 'number')).optional(),
  // NEW: Today Page timer state (P1-T1)
  timerSessions: z.array(TimerSessionSchema).optional().default([]),
  todayPreferences: TodayPreferencesSchema.optional().default({
    defaultDuration: 25,
    autoStart: false,
    soundEnabled: true,
    soundVolume: 1,
    notificationEnabled: true,
    vibrationEnabled: true,
    showRowTomatoButtons: true,
  }),
  activeTimerSession: TimerSessionSchema.optional().nullable(),
  todayTaskId: z.string().optional().nullable(),
  todayTaskDialSource: z.enum(['left', 'right']).optional().nullable(),
  // Workspace metadata (ADR-001)
  workspaceType: WorkspaceTypeEnum.optional(),
  workspaceId: z.string().optional(),
  updatedAt: z.number(),
});

export type TodoStep = z.infer<typeof TodoStepSchema>;
export type TodoRow = z.infer<typeof TodoRowSchema>;
export type PriorityDials = z.infer<typeof PriorityDialsSchema>;
export type TodoProject = z.infer<typeof TodoProjectSchema>;
export type TaskItem = z.infer<typeof TaskItemSchema>;
export type StoredProjectData = z.infer<typeof ProjectDataSchema>;
// NEW: Today Page types (P1-T1)
export type TimerInterruption = z.infer<typeof TimerInterruptionSchema>;
export type BreakSession = z.infer<typeof BreakSessionSchema>;
export type TimerSession = z.infer<typeof TimerSessionSchema>;
export type TodayPreferences = z.infer<typeof TodayPreferencesSchema>;
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed' | 'abandoned';
// NEW: Alarm system types (V1/V2)
export type AlarmRecord = z.infer<typeof AlarmRecordSchema>;
export type AlarmStatus = 'pending' | 'triggered' | 'dismissed' | 'snoozed';
export type AlarmRecurrence = z.infer<typeof AlarmRecurrenceSchema>;
export type RecurrenceType = 'once' | 'daily' | 'weekdays';
