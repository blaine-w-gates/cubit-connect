import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskItem } from './storage';
import { safeParseTasks, safeParseSearchQueries, safeParseSubSteps } from '@/lib/validation';

// MODELS
const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';

// CIRCUIT BREAKER STATE
const COOLDOWN_DURATION = 60000; // 60 Seconds
let primaryCooldownUntil = 0;

// RATE LIMIT STATE
const MIN_DELAY_MS = 2000;
let nextAllowedTime = 0;

// EVENT BUS for System Logs
export const GeminiEvents = new EventTarget();

function emitLog(message: string, type: 'info' | 'warning' | 'error' = 'info') {
  GeminiEvents.dispatchEvent(
    new CustomEvent('gemini-log', { detail: { message, type, timestamp: new Date().toLocaleTimeString() } })
  );
}

export const GeminiService = {
  // Check if Primary is hot
  isPrimaryCool() {
    return Date.now() > primaryCooldownUntil;
  },

  async enforceRateLimit() {
    const now = Date.now();
    const targetTime = Math.max(now, nextAllowedTime);
    nextAllowedTime = targetTime + MIN_DELAY_MS;
    const waitTime = targetTime - now;
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  },

  resetState() {
    nextAllowedTime = 0;
    primaryCooldownUntil = 0;
    emitLog('Systems Normal. Quota Reset.', 'info');
  },

  _resetRateLimit() {
    this.resetState();
  },

  async retryWithBackoff<T>(fn: (modelName: string) => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    // 1. Determine which model to start with
    const currentModel = this.isPrimaryCool() ? PRIMARY_MODEL : FALLBACK_MODEL;

    // Log the start if it's the first attempt (heuristic)
    if (retries === 3) {
      // emitLog(`Starting generation with ${currentModel}...`, 'info'); 
      // Commented out to reduce noise, we only log switches.
    }

    try {
      return await fn(currentModel);
    } catch (error: unknown) {
      const err = error as Error;
      const msg = err?.message?.toLowerCase() || '';

      // 429 DETECTION & FALLBACK LOGIC
      if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {

        // Scenario A: We are on PRIMARY and hit a limit.
        if (currentModel === PRIMARY_MODEL) {
          primaryCooldownUntil = Date.now() + COOLDOWN_DURATION;
          emitLog(`⚠️ Rate Limit Hit on Primary. Cooling down... Switching to ${FALLBACK_MODEL}`, 'warning');

          // IMMEDIATE RETRY with Fallback (No backoff delay needed, just switch)
          return this.retryWithBackoff(fn, retries, delay);
        }

        // Scenario B: We are already on FALLBACK and hit a limit.
        if (currentModel === FALLBACK_MODEL) {
          emitLog(`🔴 Project Quota Exceeded. Both models exhausted.`, 'error');
          throw new Error('PROJECT_QUOTA_EXCEEDED: Please update your API Key.');
        }
      }

      // Standard Retry Logic for Network Blips (503, etc)
      const isNetwork = msg.includes('fetch failed') || msg.includes('network error') || msg.includes('503');
      if (retries > 0 && isNetwork) {
        if (process.env.NODE_ENV === 'development') console.warn(`Gemini Retry (${retries} left): ${msg}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.retryWithBackoff(fn, retries - 1, delay * 2);
      }

      throw error;
    }
  },

  async withTimeout<T>(promise: Promise<T>, ms: number = 20000): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Request Timed Out (20s)')), ms);
    });
    return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeoutPromise]);
  },

  async validateConnection(apiKey: string): Promise<boolean> {
    try {
      await this.countTokens(apiKey, 'Test connection');
      return true;
    } catch {
      throw new Error('Invalid API Key');
    }
  },

  async countTokens(apiKey: string, text: string): Promise<number> {
    await this.enforceRateLimit();
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use Primary for token counting, fallback doesn't matter much here
    const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
    const { totalTokens } = await model.countTokens(text);
    return totalTokens;
  },

  // ---------------------------------------------------------------------------
  // CORE GENERATION METHODS (Updated to use dynamic modelName)
  // ---------------------------------------------------------------------------

  async analyzeTranscript(
    apiKey: string,
    transcript: string,
    mode: 'video' | 'text' = 'video',
    videoDuration?: number,
  ): Promise<TaskItem[]> {
    await this.enforceRateLimit();
    const genAI = new GoogleGenerativeAI(apiKey);

    const promptRules =
      mode === 'text'
        ? `TEXT MODE: Source is raw text. SET "timestamp_seconds": 0 for all tasks.`
        : `VIDEO MODE: Identify timestamps where new topics begin.`;

    // 0. CONTEXT CHECK (Safety Valve for Lite)
    // If transcript is huge (>25k tokens approx 100k chars), force Primary Model or fail if Primary is hot.
    // We act conservatively: If > 100,000 chars, we assume it's too big for Lite.
    const isHugeContext = transcript.length > 100000;

    if (isHugeContext && !this.isPrimaryCool()) {
      // Ideally we wait, but for now we just warn and try Primary anyway? 
      // No, if Primary is cool, we use it. If Primary is HOT (rate limited) and we try Fallback, Fallback will crash.
      // So if Primary is HOT and Context is HUGE -> We must FAIL fast to save user time.
      throw new Error('PROJECT_QUOTA_EXCEEDED: Content too large for backup model. Please upgrade or wait.');
    }

    const prompt = `
            You are an expert Instructional Designer creating a "Recipe for Life" guide for high school students.
            Your goal is to turn the raw transcript below into a logical, step-by-step Action Plan.

            RULES FOR TASKS:
            1. **Granularity:** Break the content into 4-8 distinct "Modules" or "Steps."
            2. **Naming:** Task names must be Action Verbs (e.g. "Scrape Leads" instead of "Scraping").
            3. **Description:** The description must summarize the *value* of this step (Why do we do this?).
            4. **Visual Match:** Select timestamp where the speaker *starts* explaining a new visual concept.
            5. **Language:** Simple, direct, no jargon. Use short sentences.
            6. **FORMAT:** 'timestamp_seconds' must be a RAW NUMBER (e.g. 150.5). DO NOT use "MM:SS" format.
            ${videoDuration ? `7. **CONSTRAINT:** Timestamp MUST be less than ${videoDuration} seconds.` : ''}

            FORMAT:
            [{ "task_name": "Actionable Title", "timestamp_seconds": 12.5, "description": "Clear explanation of why this step matters." }]

            ${promptRules}
            TRANSCRIPT: ${transcript.substring(0, 30000)}
        `;

    try {
      // Pass a closure that accepts the modelName
      const result = await this.retryWithBackoff(async (modelName) => {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: 'application/json' },
        });
        return this.withTimeout(model.generateContent(prompt));
      });

      const tasks = safeParseTasks(result.response.text());
      tasks.sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
      return tasks.map((t) => ({
        ...t,
        id: crypto.randomUUID(),
        screenshot_base64: '',
        sub_steps: [],
      }));
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Gemini Error:', err);
      if (err?.message?.includes('SAFETY') || err?.message?.includes('blocked')) {
        throw new Error('Safety Block: Content violates AI safety guidelines.');
      }
      throw error;
    }
  },

  async generateSearchQueries(apiKey: string, topic: string): Promise<string[]> {
    await this.enforceRateLimit();
    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `
            Generate a "Mix Tape" of 10 high-signal search queries for the topic: "${topic}".
            
            YOU MUST GENERATE 2 QUERIES FOR EACH OF THESE 5 PLATFORMS:
            1. **Instagram (Visual):** 2x Short Hashtags (1-2 words MAX, e.g. #Sourdough).
            2. **Reddit (Discourse):** 2x Short questions (e.g. "Hydration ratio?").
            3. **TikTok (Viral):** 2x Short hooks (e.g. "POV: Sourdough").
            4. **LinkedIn (Professional):** 2x Core terms (e.g. "Bakery Logistics").
            5. **Facebook (Community):** 2x Group names (e.g. "Sourdough Bakers").

            RULES:
            - **Strict Brevity:** ALL queries must be UNDER 4 WORDS.
            - **NO PLATFORM NAMES:** Do not include "Reddit", "TikTok", etc.
            - Mix them up.
            - Total: Exactly 10 queries.
            - Format: JSON Array of strings.
        `;
    try {
      const result = await this.retryWithBackoff(async (modelName) => {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: 'application/json' },
        });
        return this.withTimeout(model.generateContent(prompt));
      });
      return safeParseSearchQueries(result.response.text());
    } catch (e: unknown) {
      const err = e as Error;
      console.warn('Scout Fail:', err);
      if (err?.message?.includes('SAFETY') || err?.message?.includes('blocked')) {
        throw new Error('Safety Block: Topics violate safety guidelines.');
      }
      throw e;
    }
  },

  async generateSubSteps(
    apiKey: string,
    instruction: string,
    transcript?: string,
    neighborContext?: string,
  ): Promise<string[]> {
    await this.enforceRateLimit();
    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `
            You are a mentor teaching a student how to execute a specific task.
            
            GLOBAL CONTEXT (The bigger picture):
            "${transcript ? transcript.substring(0, 5000) : 'No background context provided.'}"

            NEIGHBOR TASKS (Scope Constraints):
            ${neighborContext || 'No sibling tasks provided.'}

            SPECIFIC INSTRUCTION (The Current Execution Step):
            "${instruction}"

            GOAL: Break the "SPECIFIC INSTRUCTION" down into 4 concrete, actionable sub-steps.

            CRITICAL RULES:
            1. **Scope Boundary:** Focus ONLY on the execution of the Current Step. Do NOT include actions that belong to the "Next Task" listed in Neighbor Tasks.
            2. **User is King:** If the "SPECIFIC INSTRUCTION" conflicts with context, follow the instruction.
            3. **Contextual Intelligence:** Use the Global Context to make the steps specific (e.g. specific names/places).
            4. **No Repetition:** Do NOT simply repeat the Task Name.
            5. **Fast-Forward:** If the Previous Task covered preparation, assume it is done. Start directly with execution.

            FORMAT: JSON Array of 4 Strings.
        `;
    try {
      const result = await this.retryWithBackoff(async (modelName) => {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: 'application/json' },
        });
        return this.withTimeout(model.generateContent(prompt));
      });
      return safeParseSubSteps(result.response.text());
    } catch (e: unknown) {
      const err = e as Error;
      console.warn('SubStep Fail:', err);
      if (err.message?.includes('PROJECT_QUOTA_EXCEEDED')) {
        throw err;
      }
      throw err;
    }
  },
};
