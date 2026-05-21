# Product Requirements Document (PRD)

> Fill this out in plain English. Kimi will read it and turn it into code.

## 1. The Goal
What are we building? One sentence.
> Example: "A Pomodoro timer that syncs task progress across devices."

## 2. The Vibe
How should it feel? Describe the experience.
> Example: "Instant. If AI is processing, show a clear progress indicator."

## 3. User Flow
Step-by-step. What does the user click, see, and get?
1. User opens the page at /route
2. User does X...
3. System responds with Y...
4. User sees Z...

## 4. Data Models
What data are we saving, reading, or passing around?
> Example: "A Task object with id, title, status, createdAt. Synced via Yjs."

## 5. API Surface / Component Interface
What Next.js routes, components, or store actions do we need?
> Example: POST /api/analyze → returns {recipe: string[]}
> Or: New component SyncButton that calls useAppStore().syncNow()

## 6. Edge Cases & Error Handling
What happens when things go wrong?
- Internet drops during sync?
- AI quota exceeded?
- File too large for Canvas processing?
- User refreshes during AI generation?
- Peer disconnects during collaborative editing?

## 7. Constraints
What must we NOT do or use?
> Example: "No new dependencies. No backend server. Video stays client-side only."
> Example: "Must work on GitHub Pages. Must support Light and Dark mode."
> Example: "Mobile touch targets must be min 44px."

## 8. Acceptance Criteria
How do we know it works?
> Example: "I click Analyze, I get a recipe checklist, and it syncs to my other device in under 5 seconds."

---
*When you are done, just tell Kimi: "Read the PRD and tell me your plan."*
