/**
 * Gemini AI Integration for Cubit Connect
 * 
 * Handles transcript analysis and task extraction.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseTasksResponse, parseSubStepsResponse } from './safety';
import type { TaskItem } from './types';

const ANALYSIS_PROMPT = `You are an instructional design AI. Analyze the following transcript from a tutorial or instructional video.

Your task:
1. Extract clear, actionable tasks/steps from the transcript.
2. Identify the timestamp (in seconds) when each instruction begins.
3. Write a brief, helpful description for each task.

Rules:
- Focus on actionable steps the viewer should take.
- Timestamps must be in seconds (integer or decimal).
- Task names should be concise (under 50 characters).
- Descriptions should explain what the viewer needs to do.
- Generate a unique ID for each task using format "task-1", "task-2", etc.

Return ONLY a JSON array with this exact structure (no markdown, no explanation):
[
  {
    "id": "task-1",
    "task_name": "Short task title",
    "timestamp_seconds": 15,
    "description": "Detailed description of what to do"
  }
]

Transcript:
`;

export interface AnalysisResult {
  tasks: TaskItem[];
  error?: string;
}

/**
 * Analyze transcript using Gemini AI
 * Returns extracted tasks with timestamps
 */
export async function analyzeTranscript(
  transcriptText: string,
  apiKey: string
): Promise<AnalysisResult> {
  if (!transcriptText || !apiKey) {
    return { tasks: [], error: 'Missing transcript or API key' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    });

    const prompt = ANALYSIS_PROMPT + transcriptText;
    const result = await model.generateContent(prompt);
    const response = result.response;

    // Check for safety blocks
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
      return { 
        tasks: [], 
        error: 'Content was blocked by AI safety filters. Please try with different content.' 
      };
    }

    const text = response.text();
    
    if (!text) {
      return { tasks: [], error: 'AI returned empty response' };
    }

    // Parse the JSON response using our safety utility
    const tasks = parseTasksResponse(text);

    // Ensure all tasks have screenshot placeholder
    const tasksWithDefaults: TaskItem[] = tasks.map((task, index) => ({
      ...task,
      id: task.id || `task-${index + 1}`,
      screenshot_base64: '',
    }));

    return { tasks: tasksWithDefaults };
  } catch (error) {
    console.error('[Gemini] Analysis failed:', error);
    
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('API_KEY_INVALID')) {
        return { tasks: [], error: 'Invalid API key. Please reset and enter a valid key.' };
      }
      if (error.message.includes('QUOTA_EXCEEDED')) {
        return { tasks: [], error: 'API quota exceeded. Please try again later.' };
      }
      if (error.message.includes('429')) {
        return { tasks: [], error: 'Rate limited. Please wait a moment and try again.' };
      }
      if (error.message.includes('Failed to parse')) {
        return { tasks: [], error: 'AI returned invalid format. Please try again.' };
      }
      return { tasks: [], error: error.message };
    }
    
    return { tasks: [], error: 'Analysis failed. Please try again.' };
  }
}

/**
 * Generate sub-steps for a specific task (The "Cubit" feature)
 */
const SUBSTEPS_PROMPT = `You are an instructional expert. The user is stuck on this step and needs it broken down into smaller, more manageable actions.

Task: "{taskName}"

Context from the tutorial transcript:
"{contextText}"

Break this specific task down into exactly 4 granular, easy-to-follow sub-steps. Each sub-step should be:
- Actionable and specific
- Simple enough to complete in under 30 seconds
- Logically ordered

Return ONLY a JSON array of exactly 4 strings. No markdown, no explanation, no numbering.
Example: ["First action", "Second action", "Third action", "Fourth action"]
`;

export interface SubStepsResult {
  subSteps: string[];
  error?: string;
}

/**
 * Generate 4 sub-steps for a specific task
 */
export async function generateSubSteps(
  taskName: string,
  contextText: string,
  apiKey: string
): Promise<SubStepsResult> {
  if (!taskName || !apiKey) {
    return { subSteps: [], error: 'Missing task name or API key' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    });

    const prompt = SUBSTEPS_PROMPT
      .replace('{taskName}', taskName)
      .replace('{contextText}', contextText || 'No additional context available.');

    const result = await model.generateContent(prompt);
    const response = result.response;

    // Check for safety blocks
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
      return { 
        subSteps: [], 
        error: 'Content was blocked by AI safety filters.' 
      };
    }

    const text = response.text();
    
    if (!text) {
      return { subSteps: [], error: 'AI returned empty response' };
    }

    // Parse the JSON response
    const subSteps = parseSubStepsResponse(text);

    // Ensure we have exactly 4 steps (pad or trim if needed)
    const normalizedSteps = subSteps.slice(0, 4);
    while (normalizedSteps.length < 4) {
      normalizedSteps.push(`Step ${normalizedSteps.length + 1}: Continue with the task`);
    }

    return { subSteps: normalizedSteps };
  } catch (error) {
    console.error('[Gemini] Sub-steps generation failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('429')) {
        return { subSteps: [], error: 'Rate limited. Please wait a moment.' };
      }
      if (error.message.includes('Failed to parse')) {
        return { subSteps: [], error: 'AI returned invalid format. Try again.' };
      }
      return { subSteps: [], error: error.message };
    }
    
    return { subSteps: [], error: 'Failed to generate sub-steps.' };
  }
}
