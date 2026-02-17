// Data Models — Source of Truth: src/schemas/storage.ts (Zod)

// --- Recursive Step Schema ---
// Steps can nest infinitely: Task → CubitStep → CubitStep → ...
interface CubitStep {
  id: string;           // UUID
  text: string;         // The instruction text
  isCompleted?: boolean; // Checkbox state
  sub_steps?: (string | CubitStep)[]; // Recursive children (Level 3+)
}

// --- Task Item ---
// Represents one "module" or step extracted by AI from video/text
interface TaskItem {
  id: string;                  // UUID
  task_name: string;           // Action-verb title (e.g. "Scrape Leads")
  timestamp_seconds: number;   // Video timestamp in seconds (0 for text mode)
  description: string;         // Why this step matters
  screenshot_base64: string;   // Base64 screenshot from video (stored in IDB)
  isExpanded: boolean;         // UI state: is the card expanded?
  sub_steps: CubitStep[];      // Level 2 Cubit steps (recursive)
}

// --- Stored Project Data ---
// The complete shape persisted to IndexedDB via idb-keyval
interface StoredProjectData {
  tasks: TaskItem[];
  transcript?: string;
  scoutResults?: string[];        // Last Scout search results
  projectType?: 'video' | 'text';
  projectTitle?: string;
  scoutTopic?: string;            // Last Scout search topic
  scoutPlatform?: string;         // Last Scout platform (instagram, tiktok, etc.)
  scoutHistory?: string[];        // Recent Scout search history
  updatedAt: number;              // Unix timestamp of last save
}
