# Product: Cubit Connect (Production Phase)

**Type:** Static Client-Side PWA
**Hosting:** GitHub Pages
**AI Engine:** Gemini 2.5 Flash (Primary) + Gemini 2.5 Flash Lite (Fallback)

## Core Architecture Constraints

1. **Local-First:** No backend. Persistence via IndexedDB (`idb-keyval`).
2. **Video Strategy:** Reference-only (File Handle). Re-hydration required on reload.
3. **Hydration Safety:** `suppressHydrationWarning` MUST be present on `<html>` to support user extensions.
4. **Schema Validation:** All data validated via Zod schemas in `src/schemas/`.

## Data & Features

1. **Recursive Tasks (CubitStep):**
   - Structure: Task → CubitStep (Level 2) → CubitStep (Level 3+). Fully recursive.
   - Each step has `id`, `text`, `isCompleted`, and optional nested `sub_steps`.
   - **Migration:** `useAppStore` contains legacy migration logic to convert old string arrays to `CubitStep` objects. DO NOT REMOVE.
2. **Visuals:**
   - Screenshots captured at **Timestamp + 0.5s** (Offset buffer for stable frames).
   - Rendered via `react-virtuoso` (Virtualization).
3. **Export:**
   - JSON Backup (Raw State) — **Privacy P0**.
   - PDF Export (Print View via `PrintableReport.tsx`).
   - Markdown Export (via `exportUtils.ts`).
4. **Scout Feature:**
   - AI-powered multi-platform search assistant.
   - Generates search queries for Instagram, Reddit, TikTok, LinkedIn, Facebook.
   - History saved to IndexedDB.
5. **Themes:**
   - Light + Dark mode via `ThemeSelector.tsx`.

## Limitations

- **Format:** Browser-native video only (MP4/WebM). No codecs (HEVC sometimes fails).
- **Rate Limit:** Application must respect Free Tier limits (`MIN_DELAY_MS`). Circuit breaker auto-switches to fallback model on quota.
