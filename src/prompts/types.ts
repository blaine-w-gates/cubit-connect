/**
 * AI Prompt Types
 *
 * Shared type definitions for all AI prompts.
 *
 * @module prompts/types
 * @description Type definitions for prompt functions and templates
 */

/**
 * Function type for generating transcript analysis prompts
 */
export type TranscriptAnalysisPromptFn = (
  transcript: string,
  mode: 'video' | 'text',
  videoDuration?: number,
) => string;

/**
 * Function type for generating sub-step prompts
 */
export type SubStepsPromptFn = (
  instruction: string,
  transcript?: string,
  neighborContext?: string,
) => string;

/**
 * Function type for generating search query prompts
 */
export type SearchQueriesPromptFn = (topic: string) => string;
