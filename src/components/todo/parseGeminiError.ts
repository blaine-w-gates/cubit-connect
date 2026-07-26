/**
 * parseGeminiError — Safely parse Google API/Gemini error messages.
 *
 * Extracted from TodoTable.tsx as part of component decomposition (#26).
 * Pure utility function — no dependencies.
 */
export function parseGeminiError(err: Error): string {
    const msg = err.message || '';
    if (msg.includes('API_KEY_INVALID') || msg.includes('API key expired') || msg.includes('API key not valid')) {
        return "Your Gemini API key is invalid or expired. Please update it in Settings.";
    }
    try {
        if (msg.includes('{')) {
            const firstBrace = msg.indexOf('{');
            const jsonStr = msg.slice(firstBrace);
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].error?.message) {
                return parsed[0].error.message;
            }
            if (parsed.error && parsed.error.message) return parsed.error.message;
        }
    } catch {
        // INTENTIONALLY HANDLING: JSON parsing failures fall back to original error string
        // This is a best-effort parsing - if it fails, return the original message
    }
    return msg;
}
