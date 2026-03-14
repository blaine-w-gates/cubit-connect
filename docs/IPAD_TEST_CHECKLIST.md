# iPad Manual Test Checklist

Target: **iPadOS Safari (current stable)**, both portrait and landscape orientations.

---

## 1. Landing Page (`/`)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 1.1 | Load landing page in **portrait** | Full page visible; headline, hero carousel, steps section, and ignition form all reachable via scroll. No content clipped behind Safari UI. | |
| 1.2 | Load landing page in **landscape** | Same as 1.1; no horizontal overflow. | |
| 1.3 | Carousel auto-advances | Slides cycle every 1.5s; text is readable; spring animation is smooth. | |
| 1.4 | **Tap PAUSE/PLAY** button on carousel | Button toggleable with single tap; 44px minimum touch target. | |
| 1.5 | **Tap pagination dots** on carousel | Navigates to the selected slide. | |
| 1.6 | Scroll up/down on page | Sticky header appears/disappears correctly. No janky scroll-fighting. | |
| 1.7 | Enter API key and tap **START** | iPad keyboard appears; input is not obscured; pressing START navigates to `/engine`. | |
| 1.8 | Rotate device mid-page | Layout adapts; no orphaned scroll positions or broken elements. | |

---

## 2. Engine Page (`/engine`)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 2.1 | Load engine page (hydrated) | Worksheet container centered; no horizontal overflow; header visible and sticky. | |
| 2.2 | **Video/Text mode toggle** | Tap-toggleable; selected mode is visually highlighted. | |
| 2.3 | Video upload (tap file input) | iPad file picker opens; selecting a video populates the zone. | |
| 2.4 | Transcript upload (tap file input) | iPad file picker opens; selecting a `.vtt`/`.srt` populates the zone. | |
| 2.5 | Text mode: type title and body text | iPad keyboard appears; inputs are not hidden behind the keyboard. Scrolling to input works. | |
| 2.6 | **Start Analysis** button | Tap triggers processing; loading state shown; tasks appear in results feed. | |
| 2.7 | Scroll results feed | Virtualized list scrolls smoothly via window scroll; no double-scrollbar. | |
| 2.8 | **Copy Markdown** (Export) | Toast confirms success; text is actually in clipboard (paste test). | |
| 2.9 | **PDF Export** (Print) | iPadOS print dialog opens or PDF is generated; no blank page or navigation block. | |
| 2.10 | Processing Log toggle | Tap "System Status" bar to open/close; log content scrolls independently. | |
| 2.11 | Scout mode: tap "Need inspiration?" | Scout view loads; topic input focused; keyboard appears. | |
| 2.12 | Scout: type topic and tap SEARCH | Results appear; platform pills are tappable; result buttons are tappable. | |
| 2.13 | Scout: tap result in "Copy Only" mode | Clipboard write succeeds; green check appears; toast if clipboard is blocked. | |
| 2.14 | **Background/foreground (swipe up + return)** | Page is still alive; if sync was active, WebSocket reconnects; no blank screen or data loss. | |
| 2.15 | Rotate device while viewing results | Layout adapts; grid remains usable; no content cut off. | |

---

## 3. Todo Page (`/todo`)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 3.1 | Load todo page (hydrated) | Header, sidebar, and task board all visible. Loading skeleton shows while IndexedDB hydrates. | |
| 3.2 | **Book Tab Sidebar: open/collapse** | Tap chevron to toggle; animation is smooth. | |
| 3.3 | Sidebar: tap project tab | Switches active project; border highlight updates. | |
| 3.4 | Sidebar: **delete button visible** without hover | Delete icon (X) is visible on touch devices (not hover-gated). | |
| 3.5 | Sidebar: **drag to reorder projects** | Touch-hold (250ms) activates drag; reorder works; overlay follows finger. | |
| 3.6 | Sidebar: tap color dot | Color accordion opens; tap a swatch to change color; accordion closes. | |
| 3.7 | **Add task** via bottom Action Bar | Tap "+ Task" button; new row appears in table; task field auto-focused. | |
| 3.8 | Edit task name (tap or double-tap) | Textarea appears; iPad keyboard opens; auto-resize works. | |
| 3.9 | Edit step cells | Same as 3.8 for each of the 4 step columns. | |
| 3.10 | **Cubit AI button** in Action Bar | Tap Cubit; tap a task row; AI generates 4 steps; loading animation shown. | |
| 3.11 | **Deep Dive button** | Tap Deep Dive; tap a step cell; new row inserted below with AI sub-steps. | |
| 3.12 | **Dial Left / Dial Right** | Tap mode; tap a step; text appears in Priority Dials widget. | |
| 3.13 | Priority Dials: **clear button visible** | Clear (X) button on each dial is visible on iPad (not hover-gated). | |
| 3.14 | Drag handle on task rows | Visible on touch devices; drag to reorder works. | |
| 3.15 | **Swipe-to-delete** a task row | Horizontal swipe removes row; undo toast appears at top-right. | |
| 3.16 | Rabbit progress: **tap to advance** | Tap rabbit emoji advances to next step; particle burst animation fires. | |
| 3.17 | Rabbit progress: **drag to a step** | Drag rabbit horizontally to a step column; progress updates; horizontal axis constraint works. | |
| 3.18 | Todo table horizontal scroll | Table scrolls left/right on iPad; sticky command column stays locked. | |
| 3.19 | **Copy Board** (Export) | Toast confirms copy; markdown is in clipboard. | |
| 3.20 | Sync status button | Tap opens sync setup modal; modal is fully scrollable and dismissible on iPad. | |
| 3.21 | **Background/foreground** | Return from background; state is preserved; sync reconnects if active. | |
| 3.22 | Rotate device | Layout adapts; table and sidebar remain usable. | |

---

## 4. Cross-Cutting Concerns

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 4.1 | **Dark mode toggle** | Tap theme selector in header; dark mode applies instantly; all pages render correctly. | |
| 4.2 | **Settings dialog** (API Key) | Opens as modal; input accepts keyboard; Save works; dialog is dismissible. | |
| 4.3 | **Sync Setup modal** | Opens; fields are usable; Connect button works; modal scrolls if needed. | |
| 4.4 | **Toast notifications** | Appear at top-right; don't overlap with header or fixed bars; dismissible with tap. | |
| 4.5 | **Error boundaries** | If a component crashes, error boundary catches it; page doesn't go blank. | |
| 4.6 | **Private browsing mode** | App loads; localStorage/IndexedDB operations degrade gracefully (no crash). | |
| 4.7 | **Split View / Slide Over** (iPad multitasking) | App remains usable at reduced width; no layout breaks. | |
| 4.8 | **External keyboard** shortcuts | Tab navigation works through interactive elements; Enter submits forms. | |

---

## How to Use This Checklist

1. Open each page in Safari on a physical iPad (or Xcode iPad Simulator).
2. Walk through each row; mark **Pass** or note the failure.
3. For clipboard tests, paste into Notes.app immediately after copying.
4. For background tests, use the home gesture (swipe up) or app switcher, wait 10+ seconds, then return.
5. File bugs for any failures with the test number (e.g., "3.14 - drag handle not visible").
