# Cubit Connect (MVP)
**Local-First AI Video Documentation**

Cubit Connect is a browser-based tool that uses AI (Google Gemini) to watch your screen recordings and automatically generate step-by-step documentation, checklists, and summary reports. 

## 🚀 Key Features

*   **Local-First Privacy:** Video files *never* leave your device. Analysis happens by extracting text transcripts and screenshots locally in the browser.
*   **AI-Powered Breakdown:** Converts messy VTT transcripts into structured, actionable tasks.
*   **Recursive Detail:** Click "Deep Dive" on any step to break it down further into micro-steps.
*   **Offline Mode:** Works without internet (viewing/exporting). AI features gracefully disable when offline.
*   **PDF Export:** One-click generation of ink-saving, black-and-white checklists for physical printing.
*   **Project Backup:** Export/Import your entire workspace as a JSON file.

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
    *   *Note: The key is stored in your browser's Local Storage. It is never sent to our servers.*

## 🛡️ Privacy & Security

*   **No Backend:** There is no database or server storage.
*   **Browser Sandbox:** All processing (video seeking, screenshot capture) happens inside the Chrome/Edge security sandbox.
*   **Data Persistence:** Your projects are saved to your browser's `IndexedDB`. If you clear your cache, you lose your data! **Export backups regularly.**

## 📄 License

MIT License.
