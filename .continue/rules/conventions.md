# Coding Conventions

## Language & Framework
This workspace is strictly TypeScript 5 / Next.js 16 / React 19 / Tailwind CSS v4.
- Frontend: Next.js with server-side rendering (GitHub Pages only).
- Styling: Tailwind CSS v4 (CSS-native @import "tailwindcss";). No tailwind.config.js.
- Icons: lucide-react ONLY. Never react-icons, fontawesome, or others.
- State: Zustand is THE state authority. No prop drilling, no duplicate state.
- Async: Prefer async/await for I/O-bound operations.

## General Rules
1. Clarity over Cleverness: Write code that is easy to read.
2. Explicit is better than implicit: Name variables exactly what they are.
3. DRY: Abstract repeated logic into reusable functions.
4. No Placeholders: Never leave TODO or // logic goes here in code output.
5. James Does Not Code: Do not ask the user to edit files manually.
6. Local-First: Video NEVER leaves device. Canvas API only. NO FFMPEG.

## TypeScript Standards
- Strict TypeScript config.
- Prefer interfaces over types for objects.
- Use unknown over any.
- Explicit return types on exported functions.
- Max 40 lines per function. Max 400 lines per file (split if exceeded).
- Linting: eslint + prettier.

## Error Handling
- Never swallow exceptions.
- Always wrap JSON.parse in try/catch.
- Strip "\`\`\`json" fences before parsing.
- Handle finishReason: SAFETY gracefully for AI calls.
- Log at the boundary, throw at the source.
- Custom error classes for domain errors.

## AI Integration
- MIN_DELAY_MS = 2000 between AI calls.
- Circuit breaker: PRIMARY_MODEL = gemini-2.5-flash, FALLBACK_MODEL = gemini-2.5-flash-lite.
- Both exhausted -> show PROJECT_QUOTA_EXCEEDED error.
- Use useRef lock or Zustand machine to prevent double-execution of AI calls.
