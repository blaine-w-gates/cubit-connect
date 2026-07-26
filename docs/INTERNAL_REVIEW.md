# Cubit Connect — Internal Architecture Review

## 1. App Structure Map

### Routes (Next.js App Router)
```
/                    → Landing page (hero + IgnitionForm for API key entry)
/engine              → AI processing engine (video/text input, Scout, results)
/todo                → Task management (TodoTable, BookTabSidebar, ActionBar)
/today               → Pomodoro focus timer (TaskFocusCard, PomodoroTimer)
/status              → Sync health dashboard (StatusPage)
/sandbox             → Gemini model testing playground
/api/health          → Health check endpoint
```

### Navigation Flow
```
Landing (/) → API key entry → auto-redirect to /engine
/engine     → Header nav to /todo, /today
/todo       → Header nav to /engine, /today
/today      → Header nav to /engine, /todo
```

### Root Layout (`src/app/layout.tsx`)
Global providers mounted once:
- `AuthInitializer` — anonymous Supabase auth on mount
- `AppReadyIndicator` — hydration sentinel
- `StorageWarningBanner` — IndexedDB quota alerts
- `OfflineIndicator` — network status
- `ErrorBoundary` + `GlobalErrorListener` — error capture
- `ThemeProvider` (next-themes) — dark/light mode
- `SyncSetupModal` — E2EE sync configuration
- `Toaster` (sonner) — toast notifications

### State Management (`useAppStore.ts` — 2,719 lines)
Single Zustand store handling:
- API key + project hydration
- Task CRUD (TaskItem[], TodoRow[])
- Project management (TodoProject[], Book Tabs)
- Yjs document sync (E2EE via Supabase Realtime)
- Pomodoro timer + sessions
- Alarm system
- Auth & identity (anonymous → authenticated migration)
- Scout feature (topic search, history)
- UI state (settings open, sync modal, processing state)

### Component Inventory (44 components)
**Engine page**: Manifesto, VideoInput, ResultsFeed, ProcessingLog, PrintableReport, ScoutView
**Todo page**: TodoTable (1,176 lines), BookTabSidebar, ActionBar, PriorityDials
**Today page**: PomodoroTimer, TaskFocusCard, TimerDisplay, TimerControls, SessionCompleteModal
**Shared**: Header, SettingsDialog, ErrorBoundary, ExportControl, ThemeSelector, etc.
**Alarm**: AlarmDashboard, AlarmTimePickerModal, NotificationPermissionBanner
**Sync**: SyncSetupModal, SyncDebugOverlay, StatusPage

---

## 2. UX Pattern Analysis

### User Journey 1: First-Time User
```
Landing → Enter API key → /engine (auto-redirect)
       → OnboardingOverlay (3 steps: Engine, Scout, To-Do)
       → Manifesto shows (empty state with 3 cards: Scout, Structure, Export)
       → User picks Scout or Structure → VideoInput appears
       → AI processes → ResultsFeed shows distilled tasks
       → User navigates to /todo to manage tasks
```

**Friction points:**
- Landing page header auto-hides after 2s — can feel broken on first visit
- No visual indication that API key is needed before reaching the engine
- OnboardingOverlay only shows on /engine, not /todo — users who bookmark /todo miss it
- Manifesto "Export" card shows a toast warning ("Start a Project First") — dead-end interaction

### User Journey 2: Returning User
```
/ → auto-redirect to /engine (if API key exists in localStorage)
  → Manifesto hidden (tasks exist from previous session)
  → ResultsFeed shows previous tasks
  → User continues working or navigates to /todo
```

**Friction points:**
- No "recent projects" or "continue where you left off" indicator
- If previous session was Scout mode, the input mode state is preserved but not visually indicated

### User Journey 3: Task Management
```
/todo → BookTabSidebar (project tabs on left)
      → PriorityDials (top: left/right focus dials)
      → TodoTable (main: task rows with 4 steps each)
      → ActionBar (bottom: Cubit, Deep Dive, Dial Left/Right, + Task)
```

**Friction points:**
- ActionBar is fixed at bottom — on mobile, it can overlap with the last table row (mitigated by pb-24)
- BookTabSidebar on mobile overlays content when expanded — no backdrop to close it
- No keyboard shortcuts for common actions (add task, complete task, switch project)
- TodoTable at 1,176 lines handles drag-drop, inline editing, AI generation, and rendering — too monolithic

### User Journey 4: Focus Session
```
/today → PomodoroTimer (center, large display)
       → TaskFocusCard (selected task from todo)
       → AlarmDashboard (upcoming alarms)
       → Settings toggle (show tomato buttons on todo rows)
```

**Friction points:**
- Timer resets to idle on every mount — no "resume" if user navigates away and back
- No connection between /today and /todo beyond `todayTaskId` — user must manually select a task
- No visual indicator on /todo that a task is currently selected for /today focus

### User Journey 5: Sync Setup
```
/todo → "Enable E2EE Sync" button → SyncSetupModal
      → Enter passphrase → connectToSyncServer()
      → Status changes: disconnected → connecting → connected
      → Peers appear in BookTabSidebar
```

**Friction points:**
- Sync is gated behind a button with technical jargon ("E2EE")
- No visual feedback during connecting phase beyond a spinner
- "Shared Projects Locked" mechanic is confusing — projects become read-only when peers are absent
- SyncDebugOverlay is always available but intended for developers — should be behind a flag

---

## 3. Architectural Issues

### 3A. God Store (`useAppStore.ts` — 2,719 lines)
The store handles 8+ distinct concerns in a single file:
1. API key + hydration
2. Task/project CRUD
3. Yjs sync (observer registration, update handling, document reset)
4. Pomodoro timer
5. Alarm system
6. Auth & identity migration
7. Scout feature
8. UI state (modals, processing, mode)

**Impact:** Every component that subscribes to any store slice re-renders when unrelated state changes. The Yjs observer logic (lines 147-325) is deeply coupled with state setters.

**Fix:** Decompose into Zustand slices:
- `createTaskSlice` — task/project CRUD
- `createSyncSlice` — Yjs, Supabase connection, peers
- `createTimerSlice` — Pomodoro, sessions, alarms
- `createAuthSlice` — auth, identity, migration
- `createUISlice` — modals, settings, processing state

### 3B. Monolithic TodoTable (`TodoTable.tsx` — 1,176 lines)
Handles drag-and-drop, inline text editing, AI sub-step generation (Cubit/Deep Dive), touch/swipe gestures, and all row rendering.

**Fix:** Extract into:
- `TodoRow.tsx` — individual row layout + drag handle
- `TodoCellEditor.tsx` — inline text input with debounce
- `TodoAIContextMenu.tsx` — Cubit/Deep Dive buttons + AI generation flow
- `TodoDragLayer.tsx` — drag-and-drop overlay and reordering logic

### 3C. Duplicate Header Rendering
Header is rendered independently on `/engine`, `/todo`, and `/today` pages with different props:
- `/engine`: full props (onPrint, resetProject, tasksLength)
- `/todo`: full props (confirmingReset, resetProject, tasksLength)
- `/today`: stub props (confirmingReset=false, resetProject=noop, tasksLength=0)

**Fix:** Move Header into root layout with pathname-based logic, eliminating per-page rendering.

### 3D. Landing Page Redirect Logic
`/app/page.tsx` checks localStorage for API key and redirects to `/engine`. But this runs in a `useEffect`, causing a flash of the landing page before redirect.

**Fix:** Use Next.js middleware or `redirect()` in a server component to avoid client-side flash.

---

## 4. Competitive Analysis

### Direct Competitors
| Feature | Cubit Connect | Notion | Linear | Todoist |
|---------|--------------|--------|--------|---------|
| AI task distillation from video | ✅ | ❌ | ❌ | ❌ |
| Social media scouting | ✅ | ❌ | ❌ | ❌ |
| E2EE real-time sync | ✅ | ❌ (server-side) | ❌ | ❌ |
| Pomodoro integration | ✅ | ❌ | ❌ | ✅ (add-on) |
| Offline-first | ✅ | Partial | ❌ | Partial |
| Mobile responsive | Partial | ✅ | ✅ | ✅ |
| Keyboard shortcuts | ❌ | ✅ | ✅ | ✅ |
| Templates | ❌ | ✅ | ✅ | ✅ |
| API/integrations | ❌ | ✅ | ✅ | ✅ |
| Onboarding | Basic (3-step) | ✅ (guided) | ✅ (guided) | ✅ (tooltip) |

### Where Cubit Connect Wins
- **AI-native**: Only app that distills video content into actionable tasks
- **Privacy-first**: E2EE sync with no server-side data access
- **Offline-first**: Full functionality without network (IndexedDB + Yjs)
- **Scout feature**: Social media topic discovery → task creation pipeline is unique

### Where Cubit Connect Falls Short
- **Mobile UX**: Notion and Linear have polished mobile apps; we have responsive CSS but no native feel
- **Keyboard navigation**: Power users expect shortcuts — we have none
- **Onboarding depth**: 3-step overlay vs. Notion's interactive guided tour
- **Performance**: 2,719-line store causes unnecessary re-renders; competitors use fine-grained selectors
- **Collaboration UX**: "Shared Projects Locked" is confusing vs. Linear's real-time multiplayer
- **Visual polish**: Competitors have consistent design systems; our components mix border-black, border-zinc-200, and border-stone-700 inconsistently

---

## 5. What It Takes to Reach A+

### A+ Criteria
1. **CI green** ✅ (achieved today)
2. **No uncommitted work** ✅ (achieved today)
3. **All tests pass reliably** ✅ (476 unit + 200 integration)
4. **Build succeeds** ✅ (12/12 pages)
5. **TypeScript clean** ✅

### Remaining for A+
6. **Store decomposition** — Split `useAppStore.ts` into slices
7. **TodoTable decomposition** — Extract sub-components
8. **Keyboard shortcuts** — Add for common actions
9. **Mobile polish** — BookTabSidebar backdrop, touch gestures refinement
10. **Sync UX redesign** — Replace "E2EE" jargon with "Share with team" + simpler flow
11. **Design system consistency** — Standardize border colors, spacing, typography
12. **Performance audit** — Profile re-renders, add React.memo where needed
13. **User testing** — Get real feedback on onboarding flow and mobile layout

### Priority Order
1. **Store decomposition** (highest impact: performance + maintainability)
2. **TodoTable decomposition** (second highest: enables future feature work)
3. **Mobile polish** (user-visible, testable)
4. **Sync UX** (unblocks collaboration adoption)
5. **Keyboard shortcuts** (power user retention)
6. **Design system** (visual consistency)
