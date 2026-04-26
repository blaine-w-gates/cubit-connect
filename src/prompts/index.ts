/**
 * AI Prompts Index
 *
 * Centralized exports for all AI prompts.
 *
 * @module prompts
 * @description Centralized AI prompt templates for Gemini API
 */

export {
  transcriptAnalysisPrompt,
  subStepsPrompt,
  testPrompt,
} from './analysis';

export { searchQueriesPrompt } from './scout';

export type {
  TranscriptAnalysisPromptFn,
  SubStepsPromptFn,
  SearchQueriesPromptFn,
} from './types';
