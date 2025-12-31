# Cubit Connect

**Transform video tutorials into actionable task lists with AI.**

Cubit Connect analyzes video transcripts using Google's Gemini AI to extract clear, step-by-step tasks — complete with screenshots from the video. When a task is too complex, click "🧊 Cube It" to break it down into 4 granular sub-steps.

![Cubit Connect](https://img.shields.io/badge/Status-MVP-green) ![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Gemini](https://img.shields.io/badge/AI-Gemini%201.5-blue)

---

## ✨ Features

- **AI-Powered Task Extraction** — Automatically identifies actionable steps from video transcripts
- **Smart Screenshots** — Captures the exact video frame for each task
- **Cubit Drill-Down** — Break complex tasks into 4 easy sub-steps with one click
- **Offline-First** — All processing happens in your browser
- **Mobile-Friendly** — Responsive design works on any device
- **Privacy-Focused** — Your data never leaves your device

---

## 🚀 How to Use

### 1. Get Your API Key
- Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
- Create a new API key
- Copy the key (starts with "AI...")

### 2. Connect Your Key
- Open Cubit Connect
- Paste your API key
- Click "Connect"

### 3. Upload Your Files
- **Video**: Select your tutorial video (MP4)
- **Transcript**: Select the caption file (VTT or SRT)
  - Tip: Use [MacWhisper](https://goodsnooze.gumroad.com/l/macwhisper) or similar tools to generate transcripts

### 4. Analyze
- Click "🚀 Start Analysis"
- Wait for AI to extract tasks
- Watch screenshots populate automatically

### 5. Cube It (Optional)
- Click "🧊 Cube It" on any task
- Get 4 detailed sub-steps instantly

---

## 🔒 Privacy Note

**Your data stays private:**

- ✅ Video files are processed locally in your browser
- ✅ Screenshots are stored in your browser's IndexedDB
- ✅ API key is stored in your browser's localStorage
- ✅ Transcript text is sent to Google Gemini for analysis
- ❌ No data is sent to any server we control
- ❌ No tracking or analytics

**Note:** When using Gemini AI, your transcript text is processed by Google's servers according to their [terms of service](https://ai.google.dev/terms).

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| State | Zustand |
| Storage | IndexedDB (idb-keyval) |
| Styling | Tailwind CSS |
| AI | Google Gemini 1.5 Flash |
| Security | DOMPurify |
| Deployment | GitHub Pages (Static Export) |

---

## 💻 Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### Project Structure
```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
│   ├── dashboard/    # Main app UI
│   ├── setup/        # API key setup
│   └── ui/           # Shared UI components
├── hooks/            # Custom React hooks
├── lib/              # Utilities & helpers
│   ├── gemini.ts     # AI integration
│   ├── safety.ts     # Input sanitization
│   ├── storage.ts    # IndexedDB wrapper
│   ├── types.ts      # TypeScript interfaces
│   ├── video-queue.ts # Async screenshot capture
│   └── vtt-parser.ts # Transcript parsing
└── store/            # Zustand state management
```

---

## 📝 License

MIT License — feel free to use, modify, and distribute.

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- AI powered by [Google Gemini](https://ai.google.dev/)
- Inspired by the need to make video tutorials more actionable

---

**Made with 🧊 by the Cubit Connect team**
