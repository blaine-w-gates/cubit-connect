# Product: Cubit Connect (Production Phase)
**Type:** Static Client-Side PWA
**Hosting:** GitHub Pages
**AI Engine:** Gemini 2.5 Flash Lite (Strict Requirement)

## Core Architecture Constraints
1. **Local-First:** No backend. Persistence via IndexedDB (`idb-keyval`).
2. **Video Strategy:** Reference-only (File Handle). Re-hydration required on reload.
3. **Hydration Safety:** `suppressHydrationWarning` MUST be present on `<html>` to support user extensions.

## Data & Features
1. **Recursive Tasks (Level 2):**
   - Structure: Task -> Sub-step (CubitStep) -> Micro-step (String).
   - **Migration:** `useAppStore` contains "Lazy Migration" logic to convert legacy string arrays to objects. DO NOT REMOVE.
2. **Visuals:**
   - Screenshots captured at **Timestamp + 1.5s** (Offset Hack).
   - Rendered via `react-virtuoso` (Virtualization).
3. **Export:**
   - JSON Backup (Raw State) - **Privacy P0**.
   - PDF Export (Print View).

## Limitations
- **Format:** Browser-native video only (MP4/WebM). No codecs (HEVC sometimes fails).
- **Rate Limit:** Application must respect Free Tier limits (`MIN_DELAY_MS`).
