/**
 * Safety utilities for input sanitization and AI response parsing
 */

import DOMPurify from 'dompurify';
import type { TaskItem } from './types';

/**
 * Sanitize VTT/SRT text input to prevent XSS
 * Strips all HTML tags and potentially dangerous content
 */
export function sanitizeInput(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Skip sanitization during SSR (no window/document available)
  if (typeof window === 'undefined') {
    return text.trim();
  }

  // DOMPurify with strict config - allow NO HTML tags
  const clean = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  return clean.trim();
}

/**
 * Strip markdown code fences from AI response
 * Handles: ```json ... ```, ```...```, and variations
 */
function stripMarkdownFences(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text.trim();

  // Remove opening fence with optional language identifier
  // Matches: ```json, ```JSON, ```, ``` json, etc.
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/i, '');
  
  // Remove closing fence
  cleaned = cleaned.replace(/\n?```\s*$/i, '');

  return cleaned.trim();
}

/**
 * Type guard to validate TaskItem structure
 */
function isValidTaskItem(obj: unknown): obj is TaskItem {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const item = obj as Record<string, unknown>;

  return (
    typeof item.id === 'string' &&
    typeof item.task_name === 'string' &&
    typeof item.timestamp_seconds === 'number' &&
    typeof item.description === 'string'
    // screenshot_base64 may be empty string initially
  );
}

/**
 * Parse AI response JSON with safety handling
 * @throws Error with clear message if parsing fails
 */
export function parseAIResponse<T = unknown>(jsonString: string): T {
  if (!jsonString || typeof jsonString !== 'string') {
    throw new Error('AI response is empty or invalid');
  }

  // Strip markdown fences
  const cleaned = stripMarkdownFences(jsonString);

  if (!cleaned) {
    throw new Error('AI response was empty after cleaning');
  }

  try {
    const parsed = JSON.parse(cleaned);
    return parsed as T;
  } catch (error) {
    // Provide helpful error message
    const preview = cleaned.substring(0, 100);
    throw new Error(
      `Failed to parse AI response as JSON. Preview: "${preview}${cleaned.length > 100 ? '...' : ''}"`
    );
  }
}

/**
 * Parse AI response specifically for TaskItem array
 * Validates structure and provides clear errors
 */
export function parseTasksResponse(jsonString: string): TaskItem[] {
  const parsed = parseAIResponse<unknown>(jsonString);

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array. Expected array of tasks.');
  }

  // Validate each item and add missing fields
  const tasks: TaskItem[] = [];
  
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    
    if (!isValidTaskItem(item)) {
      console.warn(`[Safety] Task at index ${i} is invalid, skipping:`, item);
      continue;
    }

    // Ensure screenshot_base64 exists (will be populated later)
    tasks.push({
      ...item,
      screenshot_base64: item.screenshot_base64 || '',
    });
  }

  if (tasks.length === 0) {
    throw new Error('No valid tasks found in AI response');
  }

  return tasks;
}

/**
 * Parse AI response for sub-steps (string array)
 */
export function parseSubStepsResponse(jsonString: string): string[] {
  const parsed = parseAIResponse<unknown>(jsonString);

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array. Expected array of sub-steps.');
  }

  const steps: string[] = [];

  for (const item of parsed) {
    if (typeof item === 'string' && item.trim()) {
      steps.push(sanitizeInput(item.trim()));
    }
  }

  if (steps.length === 0) {
    throw new Error('No valid sub-steps found in AI response');
  }

  return steps;
}
