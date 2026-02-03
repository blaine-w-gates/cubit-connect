import { z } from 'zod';

// --- Shared Types ---

// Task Item (Reflects the AI Output, not the Store Metadata)
export const TaskSchema = z.object({
  task_name: z.string().describe('Action-oriented title'),
  timestamp_seconds: z.number().nonnegative().describe('Timestamp in seconds'),
  description: z.string().describe('Explanation of value'),
});

/**
 * Validates the ARRAY of tasks returned by analyzeTranscript.
 */
export const TranscriptResponseSchema = z.array(TaskSchema);

// --- Sub-Steps (Level 2 & 3) ---

/**
 * Strict Schema for Sub-steps.
 * Expects exactly 4 strings as per prompt instructions.
 */
export const SubStepsResponseSchema = z
  .array(z.string())
  .min(3, { message: 'Too few steps generated' })
  .max(8, { message: 'Too many steps generated' })
  .describe('Array of actionable sub-steps');

// --- Scout (Search Queries) ---

/**
 * Schema for Omni-Mix Search Queries.
 * Expects ~10-15 strings covering Visual, Discourse, Viral, and Pro categories.
 */
export const SearchQueriesResponseSchema = z
  .array(z.string())
  .min(1, { message: 'No queries generated' });
