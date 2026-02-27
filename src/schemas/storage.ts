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

// --- To-Do Page Schemas ---
export const TodoRowSchema = z.object({
  id: z.string(),
  task: z.string(),
  steps: z.tuple([z.string(), z.string(), z.string(), z.string()]),  // Fixed 4-step grid
  isCompleted: z.boolean().optional().default(false),
  sourceStepId: z.string().optional(),  // Tracks Deep Dive origin (for future linking)
});

export const PriorityDialsSchema = z.object({
  left: z.string(),
  right: z.string(),
  focusedSide: z.enum(['left', 'right', 'none']).optional().default('none'),
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
});

export const ProjectDataSchema = z.object({
  tasks: z.array(TaskItemSchema),
  transcript: z.string().optional(),
  scoutResults: z.array(z.string()).optional(),
  projectType: z.enum(['video', 'text']).optional(),
  projectTitle: z.string().optional(),
  scoutTopic: z.string().optional(),
  scoutPlatform: z.string().optional(),
  scoutHistory: z.array(z.string()).optional(),
  // LEGACY: Flat todoRows/priorityDials (kept for migration from old format)
  todoRows: z.array(TodoRowSchema).optional().default([]),
  priorityDials: PriorityDialsSchema.optional().default({ left: '', right: '', focusedSide: 'none' }),
  // NEW: Project-scoped todo data (Book Tabs)
  todoProjects: z.array(TodoProjectSchema).optional().default([]),
  activeProjectId: z.string().optional(),
  updatedAt: z.number(),
});

export type TodoRow = z.infer<typeof TodoRowSchema>;
export type PriorityDials = z.infer<typeof PriorityDialsSchema>;
export type TodoProject = z.infer<typeof TodoProjectSchema>;
export type TaskItem = z.infer<typeof TaskItemSchema>;
export type StoredProjectData = z.infer<typeof ProjectDataSchema>;
