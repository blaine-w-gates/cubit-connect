# Cubit Connect (MVP)

![CI](https://github.com/blaine-w-gates/cubit-connect/actions/workflows/ci.yml/badge.svg)

**Local-First AI Video Documentation**

Cubit Connect is a browser-based tool that uses AI (Google Gemini) to watch your screen recordings and automatically generate step-by-step documentation, checklists, and summary reports.

## 🚀 Key Features

- **Local-First Privacy:** Video files _never_ leave your device. Analysis happens by extracting text transcripts and screenshots locally in the browser.
- **AI-Powered Breakdown:** Converts messy VTT transcripts into structured, actionable tasks.
- **Recursive Detail:** Click "Deep Dive" on any step to break it down further into micro-steps.
- **Offline Mode:** Works without internet (viewing/exporting). AI features gracefully disable when offline.
- **PDF Export:** One-click generation of ink-saving, black-and-white checklists for physical printing.
- **Project Backup:** Export/Import your entire workspace as a JSON file.

## 🛠️ Setup Guide

Since this is a client-side application, you can run it locally or host it on any static file server (GitHub Pages, Vercel, etc.).

### Prerequisites

1.  **Node.js** (v18 or higher)
2.  **Google Gemini API Key** (Free Tier available)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/cubit-connect.git
    cd cubit-connect
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:3000](http://localhost:3000).

## 🔑 Getting an API Key

1.  Go to [Google AI Studio](https://aistudio.google.com/).
2.  Click **"Get API Key"**.
3.  Copy the key.
4.  In Cubit Connect, click the **Settings (Gear)** icon and paste your key.
    - _Note: The key is stored in your browser's Local Storage. It is never sent to our servers._

## 🛡️ Privacy & Security

- **No Backend:** There is no database or server storage.
- **Browser Sandbox:** All processing (video seeking, screenshot capture) happens inside the Chrome/Edge security sandbox.
- **Data Persistence:** Your projects are saved to your browser's `IndexedDB`. If you clear your cache, you lose your data! **Export backups regularly.**

## 🔄 Sync & Collaboration (Beta)

Cubit Connect supports real-time synchronization across devices using end-to-end encryption.

### Current Implementation
- **Transport:** Supabase Realtime (PostgreSQL-backed)
- **Security:** E2EE with passphrase-derived keys (AES-256-GCM)
- **Status:** Production-ready

### Legacy System Removed
The custom WebSocket relay server has been deleted (see ADR-004). All sync now uses Supabase Realtime for improved reliability and scalability.

**Features:**
- End-to-end encryption via Web Crypto API
- Automatic reconnection with exponential backoff
- Checkpoint persistence with compression
- Feature flag system for sync enablement

**DevTools:**
```javascript
// Toggle sync in browser console
window.__toggleSupabaseSync__()

// View telemetry
window.__SYNC_TELEMETRY__
```

## 🧪 Testing & Quality

We maintain high code quality standards using automated workflows.

- **Unit Tests:** `npm test` (Vitest) - 95 tests passing
- **E2E Tests:** `npx playwright test` (Playwright)
- **Benchmarks:** `npm run test:perf` (Lighthouse)
- **Compliance:** Accessibility checks via `axe-core`.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more details.

### Phase 1 Test Results
- ✅ 66 new unit tests added
- ✅ 0 regressions in existing E2E tests
- ✅ 100% type safety maintained
- ✅ All lint checks passing

## 📄 License

MIT License.
