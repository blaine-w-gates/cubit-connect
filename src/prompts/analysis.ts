/**
 * Analysis Prompts
 *
 * AI prompts for content analysis and task breakdown.
 *
 * @module prompts/analysis
 * @description Prompts for transcript analysis and step generation
 */

/**
 * Generate prompt for transcript analysis
 *
 * Converts raw transcripts into structured task lists with timestamps.
 * Uses "Recipe for Life" methodology for high school students.
 *
 * @param transcript - Raw transcript text (truncated to 30k chars internally)
 * @param mode - 'video' (extract timestamps) or 'text' (timestamp = 0)
 * @param videoDuration - Optional video duration constraint for timestamps
 * @returns Complete prompt string for Gemini API
 */
export function transcriptAnalysisPrompt(
  transcript: string,
  mode: 'video' | 'text',
  videoDuration?: number,
): string {
  const promptRules =
    mode === 'text'
      ? `TEXT MODE: Source is raw text. SET "timestamp_seconds": 0 for all tasks.`
      : `VIDEO MODE: Identify timestamps where new topics begin.`;

  return `
            You are an expert Instructional Designer creating a "Recipe for Life" guide for high school students.
            Your goal is to turn the raw transcript below into a logical, step-by-step Action Plan.

            CRITICAL LANGUAGE RULE:
            Detect the language of the input transcript and reply ENTIRELY in that same language.
            If the input is in Chinese, respond in Chinese. If English, respond in English.
            Only use a different language if the user explicitly requests it in their input.

            RULES FOR TASKS:
            1. **Granularity:** Break the content into 4-8 distinct "Modules" or "Steps."
            2. **Naming:** Task names must be Action Verbs (e.g. "Scrape Leads" instead of "Scraping").
            3. **Description:** The description must summarize the *value* of this step (Why do we do this?).
            4. **Visual Match:** Select timestamp where the speaker *starts* explaining a new visual concept.
            5. **Language:** Simple, direct, no jargon. Use short sentences.
            6. **FORMAT:** 'timestamp_seconds' must be a RAW NUMBER (e.g. 150.5). DO NOT use "MM:SS" format.
            ${videoDuration ? `7. **CONSTRAINT:** Timestamp MUST be less than ${videoDuration} seconds.` : ''}

            FORMAT:
            [{ "task_name": "Actionable Title", "timestamp_seconds": 12.5, "description": "Clear explanation of why this step matters." }]

            ${promptRules}
            TRANSCRIPT: ${transcript.substring(0, 30000)}
        `;
}

/**
 * Generate prompt for sub-step breakdown
 *
 * Breaks a specific task instruction into 4 concrete, actionable sub-steps.
 * Considers neighbor context to avoid scope overlap.
 *
 * @param instruction - The specific task to break down
 * @param transcript - Optional global context for intelligence
 * @param neighborContext - Optional sibling tasks to avoid scope overlap
 * @returns Complete prompt string for Gemini API
 */
export function subStepsPrompt(
  instruction: string,
  transcript?: string,
  neighborContext?: string,
): string {
  return `
            You are a mentor teaching a student how to execute a specific task.
            
            CRITICAL LANGUAGE RULE:
            Detect the language of the SPECIFIC INSTRUCTION below and reply ENTIRELY in that same language.
            If the instruction is in Chinese, respond in Chinese. If English, respond in English.
            Only use a different language if explicitly requested.
            
            GLOBAL CONTEXT (The bigger picture):
            "${transcript ? transcript.substring(0, 5000) : 'No background context provided.'}"

            NEIGHBOR TASKS (Scope Constraints):
            ${neighborContext || 'No sibling tasks provided.'}

            SPECIFIC INSTRUCTION (The Current Execution Step):
            "${instruction}"

            GOAL: Break the "SPECIFIC INSTRUCTION" down into 4 concrete, actionable sub-steps.

            CRITICAL RULES:
            1. **Scope Boundary:** Focus ONLY on the execution of the Current Step. Do NOT include actions that belong to the "Next Task" listed in Neighbor Tasks.
            2. **User is King:** If the "SPECIFIC INSTRUCTION" conflicts with context, follow the instruction.
            3. **Contextual Intelligence:** Use the Global Context to make the steps specific (e.g. specific names/places).
            4. **No Repetition:** Do NOT simply repeat the Task Name.
            5. **Fast-Forward:** If the Previous Task covered preparation, assume it is done. Start directly with execution.

            FORMAT: JSON Array of 4 Strings.
        `;
}

/**
 * Simple test prompt for model comparison
 *
 * Lightweight prompt used for timing comparisons between models.
 *
 * @returns Static test prompt string
 */
export function testPrompt(): string {
  return 'Generate 3 simple JavaScript learning tasks. Return JSON array.';
}
