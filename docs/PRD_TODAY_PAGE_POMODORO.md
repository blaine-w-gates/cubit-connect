# PRD: Today Page with Pomodoro Timer
## Cubit Connect - Fogg Behavior Model Implementation

**Document Version:** 1.0  
**Date:** April 16, 2026  
**Status:** Draft for Review  
**Classification:** Critical Feature - A+ Quality Required

---

## 1. EXECUTIVE SUMMARY

### 1.1 The Problem: The Missing Half of Fogg's Model

Cubit Connect currently addresses **Fogg's High Motivation / High Difficulty** quadrant through:
- **Engine page**: Breaks complex tasks into actionable steps (facilitation trigger)
- **Todo page**: Manages tasks with priority dials and step-by-step progression

**The Gap**: When motivation is LOW but difficulty is also LOW (the "procrastination" quadrant), users need a **spark trigger** - something to overcome the emotional hurdle of starting.

### 1.2 The Solution: The "Today" Page

A focused, single-purpose page that:
1. Shows ONE task from the priority dials (reduces decision fatigue)
2. Features a prominent Pomodoro timer (25-min countdown)
3. Provides a ritualized "start" action that bypasses procrastination
4. Creates momentum through the "just start the timer" commitment

### 1.3 Success Metrics

- Users can select a dial item and start a Pomodoro session in ≤3 clicks
- Timer continues running even if user switches tabs/apps
- Completion rate of "Today" tasks increases vs. regular Todo tasks
- Users report feeling "pulled into work" rather than "forced to work"

---

## 2. THEORETICAL FOUNDATION: Fogg Behavior Model

### 2.1 Model Overview

```
BEHAVIOR = MOTIVATION × ABILITY × PROMPT

When MOTIVATION is HIGH:
  → High Difficulty → Facilitation Trigger (Engine/Todo)
  → Low Difficulty  → Simplify & Do (Todo steps)

When MOTIVATION is LOW:
  → High Difficulty → MAKE IT EASIER (break down)
  → Low Difficulty  → SPARK TRIGGER (Today Page) ← THIS FEATURE
```

### 2.2 Application to Today Page

| Fogg Component | Today Page Implementation |
|----------------|---------------------------|
| **Low Motivation** | Acknowledged via "I don't feel like it" design pattern |
| **High Ability** | Task is already broken down via Todo page; difficulty is low |
| **Spark Trigger** | Visual countdown + auditory cues + ritualized "Start" button |
| **Commitment Device** | "Just start the timer" is easier than "just do the work" |

### 2.3 The "Procrastination Paradox"

Users procrastinate on easy tasks because:
1. Emotional resistance to **starting** (not the task itself)
2. Fear of **indefinite** work duration
3. Lack of **structure** for the work session

Pomodoro solves this by:
1. The timer **decides** when to start/stop (removes emotional burden)
2. **25-minute promise** - work is finite and bounded
3. **External accountability** - the ticking clock is a "benevolent watcher"

---

## 3. USER EXPERIENCE FLOW

### 3.1 Primary Flow: Todo → Today → Completion

```
┌─────────────────────────────────────────────────────────────────┐
│  TODO PAGE                                                        │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │  Dial Left  │  │  Dial Right  │  ← User selects one item       │
│  │  "Write..." │  │  "Review..." │    (or keeps existing)       │
│  └─────────────┘  └─────────────┘                               │
│                                                                   │
│  ┌──────────────────────────────────────────┐                   │
│  │  Task: "Draft blog post intro"           │                   │
│  │  Steps: Research → Outline → Write       │                   │
│  │                                          │                   │
│  │  [🍅 Work on This in Today Page]        │  ← NEW BUTTON     │
│  └──────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TODAY PAGE                                                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    ⏱️ 25:00                                │  │
│  │              [START]  [RESET]                              │  │
│  │         "Just start the timer. The work follows."         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Current Task: Draft blog post intro                              │
│  ─────────────────────────────────                                │
│  ☐ Research competitor posts                                      │
│  ☐ Create bullet outline                                          │
│  ☐ Write 3-paragraph intro                                        │
│                                                                   │
│  [Back to Todo]  [Switch Task]  [Complete Task]                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Alternative Entry Points

1. **Direct Navigation**: Header nav → "Today" → Select from dials on page
2. **Deep Link**: `/today?task=taskId` for external integrations
3. **Notification Click**: Timer completion notification → opens Today page

### 3.3 Edge Cases & Handlings

| Scenario | Handling |
|----------|----------|
| Both dials empty | Show message: "Set your priorities in Todo first" with link |
| Timer already running | Show "Session in Progress" + remaining time |
| Browser refresh | Persist timer state, resume on return |
| Tab switch | Timer runs in background (Web Worker) |
| Task completed mid-session | Auto-stop timer, show completion celebration |
| User leaves page mid-session | Timer continues, notification on completion |

---

## 4. DATABASE & STATE ARCHITECTURE

### 4.1 New Schema Additions

```typescript
// schemas/storage.ts

// NEW: Timer session tracking
export const TimerSessionSchema = z.object({
  id: z.string(),                          // Unique session ID
  taskId: z.string(),                      // Reference to todoRow
  projectId: z.string(),                 // Reference to todoProject
  dialSource: z.enum(['left', 'right']),   // Which dial selected
  startedAt: z.number(),                   // Timestamp (ms)
  endedAt: z.number().optional(),          // Timestamp (ms) if completed
  durationMinutes: z.number().default(25), // Session length
  completed: z.boolean().default(false),   // Did user finish 25min?
  interruptions: z.number().default(0),  // Pause/resume count
});

// NEW: Today page preferences
export const TodayPreferencesSchema = z.object({
  defaultDuration: z.number().default(25),
  autoStart: z.boolean().default(false),
  soundEnabled: z.boolean().default(true),
  notificationEnabled: z.boolean().default(true),
  vibrationEnabled: z.boolean().default(true), // Mobile
});

// EXTEND: StoredProjectData additions
type StoredProjectData = {
  // ... existing fields ...
  timerSessions: TimerSession[],            // History of pomodoro sessions
  todayPreferences: TodayPreferences,
  activeTimerSession: TimerSession | null,  // Current running session
  todayTaskId: string | null,               // Currently selected task for Today
};
```

### 4.2 State Management (Zustand)

```typescript
// store/useAppStore.ts - New Actions

interface TodayState {
  // Timer State
  activeTimerSession: TimerSession | null;
  timerRemainingSeconds: number;
  timerStatus: 'idle' | 'running' | 'paused' | 'completed';
  
  // Task Selection
  todayTaskId: string | null;
  todayTaskDialSource: 'left' | 'right' | null;
  
  // Actions
  selectTaskForToday: (taskId: string, dialSource: 'left' | 'right') => void;
  clearTodayTask: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  completeTimer: () => void;
  tickTimer: () => void; // Internal, called every second
  
  // Persistence
  loadTimerState: () => Promise<void>;
  saveTimerState: () => Promise<void>;
}
```

### 4.3 Persistence Strategy

| Data | Storage | Sync | Notes |
|------|---------|------|-------|
| Active timer session | IndexedDB + Yjs | ✅ Yes | Must sync across devices |
| Timer history | IndexedDB + Yjs | ✅ Yes | Analytics/productivity tracking |
| Preferences | IndexedDB | ❌ No | Per-device settings |
| Timer countdown | In-memory only | ❌ No | Recalculate on load from startedAt |

### 4.4 Background Timer Strategy

**Problem**: JavaScript timers pause when tab is inactive.

**Solution**: Web Worker + Timestamp diff pattern

```typescript
// timerWorker.ts
self.onmessage = (e) => {
  if (e.data.type === 'START') {
    const startTime = Date.now();
    const durationMs = e.data.durationMinutes * 60 * 1000;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, durationMs - elapsed);
      
      self.postMessage({ type: 'TICK', remaining });
      
      if (remaining <= 0) {
        clearInterval(interval);
        self.postMessage({ type: 'COMPLETE' });
      }
    }, 1000);
  }
};
```

---

## 5. UI/UX DESIGN SPECIFICATION

### 5.1 Design Principles

1. **Single Focus**: One task, one timer, one page
2. **Generous Whitespace**: Breathing room reduces anxiety
3. **Gentle Contrast**: No harsh reds/yellows (this isn't urgent, it's calm)
4. **Progressive Disclosure**: Advanced options hidden until needed
5. **Celebration Moments**: Completion should feel rewarding

### 5.2 Visual Design (Matching Existing System)

#### Color Palette (Existing System)
```css
/* From globals.css */
--background: #fafafa;           /* Light mode bg */
--foreground: #111111;           /* Light mode text */
--dark-background: #1c1917;      /* Dark mode bg (stone-900) */
--dark-foreground: #e6e4d9;      /* Dark mode text (beige) */

/* Timer-specific accents */
--timer-active: #34d399;         /* Emerald 400 - running */
--timer-paused: #fbbf24;         /* Amber 400 - paused */
--timer-complete: #818cf8;       /* Indigo 400 - done */
--timer-idle: #9ca3af;           /* Gray 400 - not started */
```

#### Typography (Existing System)
- **Timer Display**: Geist Mono, 72px, weight 300 (light, elegant)
- **Task Title**: Geist Sans, 24px, weight 600
- **Step Labels**: Geist Sans, 14px, weight 400
- **Microcopy**: Geist Sans, 12px, weight 400, italic

#### Layout Structure
```
┌──────────────────────────────────────────────┐
│  HEADER (existing)                           │
│  [Logo] [Today badge] [Theme] [Settings]     │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │           TIMER SECTION                │  │
│  │                                        │  │
│  │            ⏱️ 25:00                    │  │
│  │                                        │  │
│  │     [Start]  [Reset]  [Settings]       │  │
│  │                                        │  │
│  │   "Just start the timer..."            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │           TASK SECTION               │  │
│  │                                        │  │
│  │  Current Focus:                        │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │ Draft blog post intro            │  │  │
│  │  │ [From Dial Left]                 │  │  │
│  │  └──────────────────────────────────┘  │  │
│  │                                        │  │
│  │  Steps:                                │  │
│  │  ☐ Research competitor posts          │  │
│  │  ☐ Create bullet outline             │  │
│  │  ☐ Write 3-paragraph intro           │  │
│  │                                        │  │
│  │  [Complete Task]                     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │         NAVIGATION FOOTER              │  │
│  │                                        │  │
│  │  [← Back to Todo]  [Switch Task →]     │  │
│  └────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

### 5.3 Timer Display States

| State | Visual | Interaction |
|-------|--------|-------------|
| **Idle** | Gray 25:00, subtle pulse | Start button prominent |
| **Running** | Emerald countdown, smooth ticking animation | Pause button, Reset disabled |
| **Paused** | Amber frozen time, gentle pulse | Resume/Stop buttons |
| **Completed** | Indigo 00:00, celebration burst | Dismiss/Reset/New Session |

### 5.4 Animation Specifications

```typescript
// Timer tick animation (every second)
const tickAnimation = {
  scale: [1, 1.02, 1],
  transition: { duration: 0.3, ease: "easeInOut" }
};

// Completion celebration
const celebrationAnimation = {
  scale: [1, 1.1, 1],
  rotate: [0, 5, -5, 0],
  transition: { duration: 0.6, ease: "easeOut" }
};

// Page transition (from Todo)
const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" }
};
```

---

## 6. COMPONENT ARCHITECTURE

### 6.1 New Components

```
src/
├── app/
│   └── today/
│       └── page.tsx              # Main Today page
├── components/
│   └── today/
│       ├── PomodoroTimer.tsx     # Core timer component
│       ├── TimerControls.tsx     # Start/Pause/Resume/Stop
│       ├── TimerDisplay.tsx      # Large time display
│       ├── TaskFocusCard.tsx     # Selected task display
│       ├── TodayHeader.tsx       # Today-specific header
│       └── TimerSettings.tsx     # Duration/sound settings
├── hooks/
│   └── usePomodoroTimer.ts       # Timer logic + Web Worker
├── lib/
│   └── timerWorker.ts            # Web Worker for background
└── services/
    └── timerService.ts           # Timer persistence logic
```

### 6.2 Component Specifications

#### PomodoroTimer.tsx
```typescript
interface PomodoroTimerProps {
  initialDurationMinutes?: number;
  onComplete?: () => void;
  onTick?: (remainingSeconds: number) => void;
}

// Features:
// - Web Worker integration for background timing
// - Document title update: "(23:45) Today - Cubit Connect"
// - Notification on completion
// - Sound effects (optional)
```

#### TaskFocusCard.tsx
```typescript
interface TaskFocusCardProps {
  task: TodoRow;
  dialSource: 'left' | 'right';
  onStepToggle: (stepIndex: number) => void;
  onTaskComplete: () => void;
}

// Features:
// - Shows task name + source dial
// - Checkable step list
// - Progress indicator
// - "Complete Task" button (stops timer + marks done)
```

### 6.3 Hook: usePomodoroTimer

```typescript
interface UsePomodoroTimerReturn {
  status: 'idle' | 'running' | 'paused' | 'completed';
  remainingSeconds: number;
  progressPercentage: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
}

// Implementation notes:
// - Uses Web Worker for background timing
// - Syncs with Zustand store every 5 seconds
// - Handles browser visibilitychange events
// - Plays sound on completion (if enabled)
```

---

## 7. INTEGRATION WITH EXISTING SYSTEMS

### 7.1 Todo Page Modifications

#### New: "Work on This in Today" Button

**Location**: In each TodoRow, next to the "Cubit" and "Deep Dive" buttons

**Appearance**: 
- Icon: 🍅 (tomato emoji) or Clock icon
- Label: "Today"
- Color: Matches dial color (green for left, yellow for right)

**Behavior**:
```typescript
const handleSendToToday = (row: TodoRow, dialSource: 'left' | 'right') => {
  // 1. Set as today's task
  selectTaskForToday(row.id, dialSource);
  
  // 2. Navigate to Today page
  router.push('/today');
  
  // 3. Optional: Auto-start timer (based on preference)
  if (todayPreferences.autoStart) {
    startTimer();
  }
};
```

#### Modified: PriorityDials Component

Add "Go to Today" quick action when dial is focused:
```
┌─────────────────────────────────────┐
│  Dial Left                          │
│  "Draft blog post"                  │
│                                     │
│  [🍅 Start Today Session]  [Clear]   │
└─────────────────────────────────────┘
```

### 7.2 Header Navigation

Add "Today" to header nav between "Todo" and "Engine":

```typescript
// Header.tsx navigation
const navItems = [
  { label: 'Engine', path: '/engine', icon: Compass },
  { label: 'Todo', path: '/todo', icon: ListTodo },
  { label: 'Today', path: '/today', icon: Clock },  // NEW
];
```

**Active indicator**: Show small tomato icon or timer status when session active

### 7.3 BookTabSidebar Integration

When viewing a project in Todo, add "Today's Task" indicator:
- Small 🍅 icon next to the active task in the list
- Clicking jumps to Today page with that task

### 7.4 Sync Considerations

**Critical**: Timer state must sync across devices

Scenario:
1. User starts timer on laptop
2. User switches to iPad
3. iPad should show: "Session in progress (23:45 remaining)"

**Implementation**:
- `activeTimerSession` stored in Yjs (synced)
- `startedAt` timestamp used to calculate remaining time
- Each device calculates locally: `remaining = duration - (now - startedAt)`

---

## 8. NOTIFICATION & SOUND SYSTEM

### 8.1 Completion Notifications

**Browser Notification**:
```typescript
const showCompletionNotification = () => {
  if (!('Notification' in window)) return;
  
  new Notification('Pomodoro Complete!', {
    body: 'Great focus! Take a 5-minute break.',
    icon: '/pomodoro-icon.png',
    badge: '/pomodoro-badge.png',
    tag: 'pomodoro-complete',
    requireInteraction: true,
  });
};
```

**In-App Toast** (via Sonner):
```typescript
toast.success('Pomodoro Complete!', {
  description: 'You focused for 25 minutes. Well done!',
  duration: 10000,
  action: {
    label: 'Start Break',
    onClick: () => startBreakTimer(),
  },
});
```

### 8.2 Sound Effects (Optional)

| Event | Sound | Default |
|-------|-------|---------|
| Timer Start | Soft chime | Off |
| 5-min Warning | Gentle bell | Off |
| Completion | Success chime | On |
| Break End | Soft alarm | On |

**Implementation**: Web Audio API for reliable playback

### 8.3 Mobile Vibration

```typescript
const vibrate = (pattern: number[]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// Completion: 3 short pulses
vibrate([200, 100, 200, 100, 200]);
```

---

## 9. EDGE CASES & ERROR HANDLING

### 9.1 Timer Drift

**Problem**: Web Worker timing may drift slightly

**Solution**: 
- Sync with actual `Date.now()` diff every 10 seconds
- Store `startedAt` and calculate remaining from that
- Never rely on counter increments alone

### 9.2 Midnight Crossover

**Problem**: Timer running past midnight

**Solution**: 
- Use UTC timestamps
- No special handling needed (math works correctly)

### 9.3 Task Deleted Mid-Session

**Problem**: User deletes task in Todo while timer running

**Solution**:
```typescript
// In Today page, check if task exists
useEffect(() => {
  if (todayTaskId && !todoRows.find(r => r.id === todayTaskId)) {
    // Task was deleted
    toast.error('Task was deleted');
    stopTimer();
    clearTodayTask();
  }
}, [todoRows, todayTaskId]);
```

### 9.4 Multiple Devices

**Problem**: User starts timer on device A, opens Today on device B

**Solution**: 
- Sync `activeTimerSession` via Yjs
- Calculate remaining time from `startedAt` on each device
- Show "Session started on another device" indicator

### 9.5 Browser Close/Refresh

**Problem**: User closes browser with timer running

**Solution**:
- Store `startedAt` in `beforeunload` handler
- On page load, check for active session and resume

---

## 10. TESTING STRATEGY

### 10.1 Unit Tests

| Component | Test |
|-----------|------|
| usePomodoroTimer | Start, pause, resume, complete flow |
| TimerDisplay | Correct formatting (25:00 → 24:59 → 0:00) |
| TaskFocusCard | Step toggling, completion flow |

### 10.2 Integration Tests

| Flow | Test |
|------|------|
| Todo → Today | Click "Today" button → Navigates with correct task |
| Background timer | Start → Switch tab → 25s → Return → Shows correct time |
| Sync | Start on Device A → Check Device B → Shows active session |
| Completion | Timer ends → Notification shown → Task can be completed |

### 10.3 E2E Tests

| Scenario | Steps |
|----------|-------|
| Full Pomodoro | Todo → Select task → Today → Start → Wait 25s → Complete |
| Pause/Resume | Start → Pause → Wait 10s → Resume → Verify remaining time |
| Task switch | Today with Task A → Back to Todo → Select Task B → Today shows B |

---

## 11. IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1)
- [ ] Create Today page route + basic layout
- [ ] Implement Web Worker timer
- [ ] Add timer state to Zustand store
- [ ] Add "Today" button to TodoTable rows

### Phase 2: Integration (Week 2)
- [ ] Task selection flow (Todo → Today)
- [ ] TaskFocusCard component
- [ ] Timer controls + display
- [ ] Header navigation update

### Phase 3: Polish (Week 3)
- [ ] Notifications + sound
- [ ] Animations + visual feedback
- [ ] Edge case handling
- [ ] Mobile responsiveness

### Phase 4: Sync (Week 4)
- [ ] Yjs integration for timer state
- [ ] Cross-device session sync
- [ ] Testing + bug fixes

---

## 12. SELF-ASSESSMENT CHECKLIST

### Quality Standards

| Criterion | Target | Met? |
|-----------|--------|------|
| **Fogg Alignment** | Properly addresses Low Motivation quadrant | ⬜ |
| **Design Consistency** | Matches existing Cubit Connect aesthetic | ⬜ |
| **Database Integrity** | No breaking changes, proper schema additions | ⬜ |
| **Sync Compatibility** | Works with existing Yjs sync infrastructure | ⬜ |
| **Mobile Ready** | Touch-friendly, responsive, works on iPad/iPhone | ⬜ |
| **Accessibility** | ARIA labels, keyboard navigation, screen readers | ⬜ |
| **Performance** | No render blocking, 60fps animations | ⬜ |
| **Error Handling** | All edge cases documented and handled | ⬜ |

---

## 13. OPEN QUESTIONS FOR CLARIFICATION

1. **Sound**: Should we include default sounds or keep silent-only for MVP?
2. **Break Timer**: Include 5-minute break timer or keep it manual?
3. **Stats**: Track daily/weekly Pomodoro count? (Productivity analytics)
4. **Customization**: Allow custom durations (15/25/45/60 min) or fixed 25?
5. **Visual Theme**: Should timer have distinct visual identity or blend completely?

---

## APPENDIX A: EXISTING CODE REFERENCES

### Dial Selection Pattern (from TodoTable.tsx)
```typescript
const handleStepClick = useCallback((row: typeof todoRows[0], stepIdx: number) => {
    const stepText = row.steps[stepIdx].text;
    if (!stepText.trim()) return;

    const currentMode = useAppStore.getState().activeMode;

    if (currentMode === 'deepDive') {
        handleDeepDive(row.id, stepText, row);
    } else if (currentMode === 'dialLeft') {
        setDialPriority('left', stepText);
        setActiveMode(null);
    } else if (currentMode === 'dialRight') {
        setDialPriority('right', stepText);
        setActiveMode(null);
    }
}, [handleDeepDive, setDialPriority, setActiveMode]);
```

### Navigation Pattern (from Header.tsx)
```typescript
const router = useRouter();
const isTodoPage = pathname === '/todo';

<button onClick={() => router.push('/todo')}>
    <ListTodo className="w-4 h-4" />
    <span>To Do</span>
</button>
```

### Store Pattern (from useAppStore.ts)
```typescript
const ydocOptions: { gc: boolean; clientID?: number } = { 
  gc: false,
  clientID: generateUniqueClientId()
};

// Persistence via storageService
saveProject: async (state) => {
  await storageService.saveProject(
    state.tasks,
    state.transcript,
    // ... other fields
  );
}
```

---

**END OF PRD**
