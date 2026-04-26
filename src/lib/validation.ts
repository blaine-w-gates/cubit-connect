import {
  TranscriptResponseSchema,
  SubStepsResponseSchema,
  SearchQueriesResponseSchema,
} from '@/schemas/gemini';

// ---------------------------------------------------------------------------
// 🛠️ UTILITY: JSON REPAIR & SANITIZER
// ---------------------------------------------------------------------------
export function repairJson(text: string): string {
  if (!text) return '[]';

  // 1. Strip Markdown Code Blocks (```json ... ```)
  let clean = text.replace(/```json/g, '').replace(/```/g, '');

  // 2. Extract JSON Array/Object if buried in conversational text
  const arrayMatch = clean.match(/\[[\s\S]*\]/);
  const objectMatch = clean.match(/\{[\s\S]*\}/);

  if (arrayMatch) {
    clean = arrayMatch[0];
  } else if (objectMatch) {
    clean = objectMatch[0];
  }

  // 3. 🛡️ IRON DOME: Timestamp Fix (MM:SS -> Seconds)
  // Fixes "timestamp_seconds": 1:11.80 -> "timestamp_seconds": 71.8
  // Also handles quoted vs unquoted cases if AI messes up
  clean = clean.replace(/"timestamp_seconds":\s*"?(\d+):(\d+(\.\d+)?)"?/g, (match, m, s) => {
    const total = parseInt(m) * 60 + parseFloat(s);
    return `"timestamp_seconds": ${total}`;
  });

  return clean.trim();
}

// ---------------------------------------------------------------------------
// 🛡️ SAFE PARSERS (The Gatekeepers)
// ---------------------------------------------------------------------------
export function safeParseTasks(rawText: string) {
  try {
    const json = JSON.parse(repairJson(rawText));
    return TranscriptResponseSchema.parse(json);
  } catch (error) {
    // INTENTIONALLY PROPAGATING: Task parsing failure is critical
    // AI response must be valid for core functionality - show error to user
    console.error('Task Parse Failed:', error);
    throw new Error('Failed to parse AI response. The generated plan was invalid.');
  }
}

export function safeParseSubSteps(rawText: string) {
  try {
    const json = JSON.parse(repairJson(rawText));
    return SubStepsResponseSchema.parse(json);
  } catch (error) {
    // INTENTIONALLY RETURNING EMPTY: Sub-step parsing is best-effort
    // Failure returns empty array so app continues without sub-steps
    console.warn('SubStep Parse Failed - Returning Empty Default', error);
    return [];
  }
}

export function safeParseSearchQueries(rawText: string) {
  try {
    const json = JSON.parse(repairJson(rawText));
    return SearchQueriesResponseSchema.parse(json);
  } catch (error) {
    // INTENTIONALLY RETURNING EMPTY: Search query parsing is best-effort
    // Failure returns empty array so app continues without search queries
    console.warn('Scout Parse Failed - Returning Empty Default', error);
    return [];
  }
}
