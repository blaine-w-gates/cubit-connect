/**
 * Scout Prompts
 *
 * AI prompts for the Scout feature (multi-platform search assistant).
 *
 * @module prompts/scout
 * @description Prompts for generating platform-specific search queries
 */

/**
 * Generate prompt for multi-platform search queries
 *
 * Creates 10 high-signal search queries across 5 platforms:
 * - Instagram (2x visual hashtags)
 * - Reddit (2x discussion questions)
 * - TikTok (2x viral hooks)
 * - LinkedIn (2x professional terms)
 * - Facebook (2x community groups)
 *
 * All queries in same language as input topic.
 *
 * @param topic - The search topic to generate queries for
 * @returns Complete prompt string for Gemini API
 */
export function searchQueriesPrompt(topic: string): string {
  return `
            Generate a "Mix Tape" of 10 high-signal search queries for the topic: "${topic}".
            
            CRITICAL LANGUAGE RULE:
            Detect the language of the input topic and generate queries in that SAME language.
            If the topic is in Chinese, create Chinese search queries. If English, create English queries.
            
            YOU MUST GENERATE 2 QUERIES FOR EACH OF THESE 5 PLATFORMS:
            1. **Instagram (Visual):** 2x Short Hashtags (1-2 words MAX, e.g. #Sourdough).
            2. **Reddit (Discourse):** 2x Short questions (e.g. "Hydration ratio?").
            3. **TikTok (Viral):** 2x Short hooks (e.g. "POV: Sourdough").
            4. **LinkedIn (Professional):** 2x Core terms (e.g. "Bakery Logistics").
            5. **Facebook (Community):** 2x Group names (e.g. "Sourdough Bakers").

            RULES:
            - **Strict Brevity:** ALL queries must be UNDER 4 WORDS.
            - **NO PLATFORM NAMES:** Do not include "Reddit", "TikTok", etc.
            - Mix them up.
            - Total: Exactly 10 queries.
            - Format: JSON Array of strings.
        `;
}
