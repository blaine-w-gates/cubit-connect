# MASTER CALIBRATION: CUBIT CONNECT
**Document Purpose:** Absolute laws of physics, constraints, and execution protocols.  
**Version:** 2.0  
**Last Updated:** March 27, 2026  
**Project:** Cubit Connect — Local-First AI Knowledge Distillation Engine

---

## 1. CORE INTENT & ESCALATION TRIGGERS

### Primary Objective
Build a production-ready, scalable web application that turns raw video/text into actionable "Recipe for Life" checklists using AI (Gemini) while maintaining strict local-first privacy (video never leaves device).

### Trade-off Hierarchy (Non-Negotiable)
1. **Data Integrity & Security** — Never compromise user data
2. **Code Readability & Maintainability** — Explicit over clever
3. **UI/UX Polish** — Clean Enterprise aesthetic
4. **Execution Speed** — Optimize only after correctness

### Escalation Triggers (STOP and Ask Human)
- [ ] Conflicting instructions in Master Specification
- [ ] Destructive database migration or file deletion
- [ ] Unable to verify task via deterministic testing
- [ ] Required context exceeds current limits
- [ ] Yjs sync not working (current active issue)
- [ ] Test timeout despite code "looking correct"
- [ ] Need to install new dependency not in approved list
- [ ] Modifying frozen zones (VideoInput.tsx drag-drop state machine)
- [ ] Changing AI prompt that affects instructional design
- [ ] API key or encryption-related changes

---

## 2. CONSTRAINT ARCHITECTURE

### MUST DO (Non-Negotiable Mandates)
- [ ] **Tech Stack Strict Compliance:** Next.js 16, Tailwind v4, Zustand, idb-keyval, Yjs, Gemini API
- [ ] **Blind/Low-Resource Protocol:** No macro-architecture planning beyond Master Spec
- [ ] **Input/Output Validation:** All system boundaries validated with Zod
- [ ] **Icons:** `lucide-react` ONLY (ban react-icons, fontawesome)
- [ ] **Local-First:** Video NEVER leaves device (Canvas API only, NO FFMPEG)
- [ ] **GitHub Pages Only:** No server infrastructure
- [ ] **Theme Support:** Light + Dark modes via ThemeSelector.tsx
- [ ] **Mobile Touch:** All targets min 44px, verify "Mobile Smash"
- [ ] **AI Rate Limiting:** MIN_DELAY_MS = 2000 between calls
- [ ] **Circuit Breaker:** Dual-model fallback (Primary + Fallback Gemini models)
- [ ] **Chain of Verification:** Every task needs deterministic proof
- [ ] **Git Commit After Success:** `[Agent] Verified completion: {Task}`

### MUST NOT DO (Explicit Prohibitions)
- [ ] **Hallucinate Dependencies:** Never install unapproved packages
- [ ] **Proceed Without Verification:** Step N+1 requires Step N proof
- [ ] **Refactor Working Code:** Unless explicitly in task spec
- [ ] **Placeholder Code:** Never output `// logic goes here`
- [ ] **Touch .env Files:** Without explicit human permission
- [ ] **Generic AI Prompts:** Never revert instructional design to generic summaries
- [ ] **Synchronous Video Loops:** Never loop timestamps without `video.onseeked`
- [ ] **Unscaled Canvas Images:** Always downscale to max 640px
- [ ] **Bare JSON.parse:** Always wrap in try/catch
- [ ] **Double AI Execution:** Use useRef lock or Zustand machine
- [ ] **Remove suppressHydrationWarning:** Keep on `<html>` and `<body>`

### PREFERENCES (When Ambiguous)
- Prefer explicit, verbose variable naming over abbreviated cleverness
- Prefer duplication over wrong abstraction (wait for PM to define shared components)
- Prefer `getByRole` with `exact: true` over text selectors in tests
- Prefer store evaluation over UI assertions for sync verification

---

## 3. THE GRAVEYARD (Anti-Patterns to Avoid)

### Trap 1: The UI Loop
**Symptom:** Adjusting CSS padding for 10+ turns  
**Prevention:** Stop after 2 failed UI attempts, escalate to human  
**Recovery:** Back out to last working state, reassess approach

### Trap 2: The Over-write
**Symptom:** Overwriting environment variables during scaffolding  
**Prevention:** Never touch .env without explicit permission  
**Recovery:** Check git history, restore from backup

### Trap 3: The Sync Timeout Death Spiral (ACTIVE ISSUE)
**Symptom:** Tests timeout despite peer connection working (👥 2+ visible)  
**Root Cause:** Yjs updates not propagating even though WebSocket connected  
**Prevention:** 
- Verify room ID derivation matches between peers
- Check ydoc.on('update') → broadcastUpdate chain
- Ensure networkSync.broadcastUpdate() actually called
- Verify WebSocket message transmission through relay  
**Recovery:** 
- Create minimal reproduction test (ping-pong-debug.spec.ts)
- Add Yjs state inspection utilities
- Trace message flow: ydoc → encrypt → WebSocket → relay → peer → decrypt → apply

### Trap 4: The Placeholder Code Trap
**Symptom:** `// logic goes here` or `TODO: implement` in output  
**Prevention:** Write complete, functional chunks only  
**Recovery:** Identify placeholder, replace with actual implementation

### Trap 5: The Macro-Planning Hallucination
**Symptom:** Agent plans architecture beyond provided Master Spec  
**Prevention:** Strict "Blind Handoff" mode for weak models  
**Recovery:** Reset to spec boundaries, discard hallucinated plans

### Trap 6: The Dependency Guessing Game
**Symptom:** Installing packages not in approved list  
**Prevention:** Check package.json dependencies before any install  
**Recovery:** Remove unapproved packages, use existing stack

### Trap 7: The Refactoring Reflex
**Symptom:** "While I'm here, I'll clean up this code..."  
**Prevention:** Don't refactor working code without explicit plan  
**Recovery:** Revert refactoring, focus on task scope only

### Trap 8: The Yjs Closure Issue
**Symptom:** `ReferenceError: projA is not defined` in waitForFunction  
**Prevention:** Pass arguments explicitly to waitForFunction, don't use closures  
**Recovery:** Change `() => check(projA)` to `(arg) => check(arg), projA`

### Trap 9: The Async Video Sync Loop
**Symptom:** Looping through video timestamps synchronously  
**Prevention:** Use recursive function/queue waiting for `video.onseeked`  
**Recovery:** Refactor to event-driven queue pattern

### Trap 10: The Memory Safety Blindspot
**Symptom:** Canvas images causing memory issues  
**Prevention:** Always downscale to max 640px  
**Recovery:** Add virtualization for long lists

### Trap 11: The JSON Parse Assumption
**Symptom:** Crash on malformed API response  
**Prevention:** Always wrap JSON.parse in try/catch, strip ```json fences  
**Recovery:** Add validation layer, handle parse errors gracefully

### Trap 12: The AI Double-Execution
**Symptom:** Duplicate AI calls causing quota issues  
**Prevention:** Use useRef lock or Zustand machine  
**Recovery:** Add execution guards, check for pending state

### Trap 13: The Rate Limit Blindside
**Symptom:** 429 errors from Gemini API  
**Prevention:** Respect 2s+ delay between AI calls  
**Recovery:** Implement circuit breaker, add exponential backoff

### Trap 14: The Hydration Crash
**Symptom:** "Jetski" extension crashes in browser  
**Prevention:** Keep suppressHydrationWarning on html and body  
**Recovery:** Add hydration warning suppression

### Trap 15: The Naive Selector
**Symptom:** Playwright test can't find button  
**Prevention:** Use exact match selectors: `{ name: 'Task', exact: true }`  
**Recovery:** Use getByRole with exact match, avoid text substring matching

---

## 4. STANDARD OPERATING PROCEDURE

### Phase 0: Environmental Sanity Check (REQUIRED)
Before writing ANY code:
1. Run `npm run type-check` — confirm no TypeScript errors
2. Run `npm run lint` — confirm no lint violations
3. Run `npm run test:quick` — confirm baseline tests pass
4. Check `git status` — confirm clean working directory
5. Review `tasks/active_context.md` — understand current phase

### Phase 1: Execution of Sub-Task
- Execute ONLY current isolated sub-task (< 30-120 minute chunk)
- Do not look ahead, do not break boundaries
- Follow Master Specification exactly
- If spec is unclear, STOP and ask for clarification

### Phase 2: Chain of Verification (MANDATORY)
Prove success with deterministic output:
- [ ] Unit test passes (`npm test -- {test-name}`)
- [ ] E2E test passes (`npx playwright test {test-file}`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Console.log output matches expected (for debugging)

**"Looks good" is NOT verification. Measurable output IS.**

### Phase 3: State Preservation
Upon verified success:
```bash
git add .
git commit -m "[Agent] Verified completion: {Task Name}"
```

### Phase 4: Proceed or Await Handoff
- If autonomous: Move to next sub-task
- If "Blind Handoff" mode: Output verification logs for human

---

## 5. OUTPUT & LOGGING

### Required Documentation
Maintain `tasks/active_context.md` with:
- [x] Completed tasks
- [ ] Current task in progress
- [ ] Blockers or issues encountered
- [ ] Decisions made and rationale

### Feature Plan Template
For each feature, create `tasks/feature_{name}.md`:
```markdown
# Feature: {Name}
## Intent
## Acceptance Criteria
## Constraint Architecture
## Task Decomposition
## Verification Steps
## Graveyard Risks
```

---

## 6. CURRENT STATE VECTOR (March 27, 2026)

### Active Phase
**Phase 5:** Maintenance & Feature Expansion — Sync Debug Mode

### Known Issues (Ghosts)
- **SYNC-001:** Yjs updates not propagating despite peer connection (ACTIVE)
- **SYNC-002:** Playwright tests timeout on data sync verification
- **QUOTA-001:** Gemini API rate limits (circuit breaker mitigates)

### Frozen Zones (DO NOT TOUCH)
- `src/components/VideoInput.tsx` — Drag & drop state machine
- `src/hooks/useVideoProcessor.ts` — Video processing logic

### Unlocked for Work
- `tests/ping-pong-*.spec.ts` — Sync test debugging
- `src/lib/networkSync.ts` — WebSocket/Yjs sync logic
- `src/store/useAppStore.ts` — State management

### Recent Decisions
- Defer y-indexeddb adoption (ADR-002)
- PersonalUno / PersonalMulti workspace model implemented
- All 23 quick tests pass, 14 sync tests flaky

---

## 7. IGNITION PROMPT (For New AI Instances)

Copy and paste this into the chat to initialize:

```
Read the `.cursorrules` and `master_calibration.md` files to load project constraints and intent. Confirm you understand:

1. The three most critical constraints that will dictate your execution
2. The current active issue (SYNC-001: Yjs propagation failing)
3. The Trade-off Hierarchy (Data Integrity > Maintainability > UI > Speed)

Run Phase 0 Environmental Sanity Check:
- npm run type-check
- npm run lint  
- npm run test:quick

Report the baseline state. Do not propose features or write code yet. Wait for my Master Specification.
```

---

## 8. AGENT TEAM ROLES (Mixture of Experts)

### Role 1: Specification Lead (AI PM)
**Purpose:** Translate vision into airtight blueprints  
**Outputs:** Master Spec with Intent, Acceptance Criteria, Constraint Architecture  
**Init Prompt:** "You are the Specification Lead for Cubit Connect..."

### Role 2: Constraint Architect  
**Purpose:** Build rigid technical boundaries  
**Outputs:** Must Do / Must Not Do / Graveyard updates  
**Init Prompt:** "You are the Constraint Architect for Cubit Connect..."

### Role 3: Task Decomposer
**Purpose:** Shatter specs into safe, executable chunks  
**Outputs:** Sub-tasks <2hr with verification steps  
**Init Prompt:** "You are the Task Decomposer for Cubit Connect..."

### Role 4: Execution Agent
**Purpose:** Execute micro-specs, no thinking beyond scope  
**Outputs:** Working code with deterministic proof  
**Init Prompt:** "You are the Execution Agent for Cubit Connect..."

---

**END OF MASTER CALIBRATION**
