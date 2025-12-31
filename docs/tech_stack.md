# Tech Stack: Cubit Connect

## Framework & Build

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.x | App Router, Static Export |
| **React** | 18.x | UI Components |
| **TypeScript** | 5.x | Type Safety |

### Next.js Configuration
```javascript
// next.config.js
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
}
```

---

## State Management

| Library | Purpose |
|---------|---------|
| **zustand** | Global state (API key, video, tasks, processing status) |

> **Why Zustand over React Context?**  
> - No provider wrapper hell  
> - Built-in persistence middleware  
> - Simpler async actions  
> - Better performance (no unnecessary re-renders)

---

## Storage

| Library | Purpose |
|---------|---------|
| **idb-keyval** | IndexedDB wrapper for large data (screenshots, transcripts) |
| **LocalStorage** | Small config (API key, theme) — native browser API |

---

## Security

| Library | Purpose |
|---------|---------|
| **isomorphic-dompurify** | Sanitize VTT/SRT input before parsing |

---

## Styling

| Technology | Purpose |
|------------|---------|
| **Tailwind CSS** | Utility-first, mobile-first styling |
| **tailwind-merge** | Merge conflicting classes cleanly |

---

## Video Processing

| Technology | Purpose |
|------------|---------|
| **HTML5 Video API** | Playback, seeking, duration |
| **Canvas API** | Frame capture, downscaling |

> **No FFmpeg** — All processing via native browser APIs

---

## Utilities

| Utility | Implementation |
|---------|----------------|
| **VTT Parsing** | Custom Loose Regex (no external parser) |
| **UUID Generation** | `crypto.randomUUID()` (native) |
| **JSON Parsing** | `JSON.parse` with try/catch + markdown fence stripping |

---

## AI Integration

| Service | Details |
|---------|---------|
| **Google Gemini API** | `@google/generative-ai` package |
| **Model** | `gemini-1.5-flash` (fast, cost-effective) |
| **Endpoint** | `https://generativelanguage.googleapis.com` |

---

## Deployment

| Platform | Configuration |
|----------|---------------|
| **GitHub Pages** | Static hosting, custom domain optional |
| **Build Command** | `next build` |
| **Output Directory** | `out/` |

---

## Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Safari | 15+ (iOS & macOS) |
| Firefox | 90+ |
| Edge | 90+ |

> **Note:** Private browsing mode may disable IndexedDB persistence.

---

## Package Summary

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "zustand": "^4.0.0",
    "idb-keyval": "^6.0.0",
    "isomorphic-dompurify": "^2.0.0",
    "@google/generative-ai": "^0.21.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0"
  }
}
```
