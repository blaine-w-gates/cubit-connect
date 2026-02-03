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
  sub_steps: z.array(CubitStepSchema).optional().default([]),
});

export const ProjectDataSchema = z.object({
  tasks: z.array(TaskItemSchema),
  transcript: z.string().optional(),
  scoutResults: z.array(z.string()).optional(),
  projectType: z.enum(['video', 'text']).optional(),
  projectTitle: z.string().optional(),
  scoutTopic: z.string().optional(),
  scoutPlatform: z.string().optional(),
  updatedAt: z.number(),
});

export type TaskItem = z.infer<typeof TaskItemSchema>;
export type StoredProjectData = z.infer<typeof ProjectDataSchema>;
