# Product: Cubit Connect (MVP)

**Type:** Static Client-Side Web Application  
**Hosting:** GitHub Pages  
**AI Integration:** Google Gemini API (`google-generative-ai`)

---

## Core Architecture (Critical)

### 1. No Backend
- Static export (`output: 'export'`)
- All processing happens client-side in the browser

### 2. Hybrid Storage Strategy

| Storage Type | Data Stored | Reason |
|--------------|-------------|--------|
| **LocalStorage** | API Key, Theme preferences | Fast access for small config |
| **IndexedDB** | Screenshots, Transcripts, Task data | Prevents 5MB LocalStorage crash |

### 3. Graceful Degradation

- **Private Browsing Mode:** Detect if IndexedDB is blocked. Fallback to "Session Memory" (RAM) with a warning that data won't persist.
- **Video Re-Hydration:** On reload, if video handle is lost, prompt user to re-select the file. Tasks remain intact in IndexedDB.

### 4. Security Layer

- **Input Sanitization:** All VTT/SRT inputs must be sanitized via `DOMPurify` before parsing.
- **CSP Meta Tag:** Inject Content Security Policy allowing only:
  - `'self'`
  - `blob:`
  - `https://generativelanguage.googleapis.com`

---

## Feature Logic

### 1. Setup Flow
- User enters Gemini API Key
- **Validation:** App must perform a "Test Key" call (e.g., `models.list()`) before saving
- Invalid key = show error, do not persist
- Valid key = save to LocalStorage, proceed to main UI

### 2. Analysis Flow
- User uploads video file + VTT/SRT transcript
- **VTT Parsing:** Use Loose Regex Strategy (tolerant of MacWhisper non-standard headers)
- **AI Request:** Send transcript text to Gemini
- **Prompt Constraint:** "Return JSON array. Strip all Markdown formatting."
- **Safety Handler:** Check `finishReason`. If `SAFETY`, show graceful message: "Content blocked by AI Safety filters"

### 3. Visual Extraction
- **Async Queue:** Recursive queue for screenshots:
  1. `video.currentTime = timestamp`
  2. Wait for `onseeked` event
  3. Capture frame to canvas
  4. Downscale to max-width 640px
  5. Export as JPEG (0.7 quality)
  6. Next task in queue
- **Mobile Optimization:** Max 640px width prevents iOS memory crash

### 4. Cubit Interface (Sub-step Generation)
- **Context Aware:** Send task name + 30 seconds of surrounding transcript context to AI
- **Recursion Guard:** Max Depth = 1. Sub-steps cannot have their own sub-steps.
- **Rate Limiting:** Client-side queue for AI requests to prevent `429` errors

---

## User Flows

### Flow 1: First-Time Setup
```
Open App → Enter API Key → Test Key → Success → Save → Show Main UI
```

### Flow 2: Video Analysis
```
Select Video → Select VTT → Parse Transcript → Send to AI → 
Display Task List → Capture Screenshots (async) → Done
```

### Flow 3: Cubit Drill-Down
```
Click Task → Click "Cubit" → Send Context to AI → 
Display Sub-Steps (no further Cubit button)
```

### Flow 4: Resume Session
```
Open App (tasks exist, no video) → Show "Re-Select Video" prompt →
User selects file → Video handle restored → Continue
```

---

## Success Criteria (MVP)

- [ ] API Key validation works before save
- [ ] VTT parsing handles MacWhisper format
- [ ] Screenshots captured without browser crash
- [ ] AI responses parsed correctly (with safety fallback)
- [ ] Works on mobile Safari (iOS 15+)
- [ ] Data persists across page reloads (when not in private mode)
