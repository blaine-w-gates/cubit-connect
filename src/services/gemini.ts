import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskItem } from './storage';
import { safeParseTasks, safeParseSearchQueries, safeParseSubSteps } from '@/lib/validation';

// UPGRADE: Gemini 2.5 Flash-Lite (Stable)
// High Throughput (30 RPM) | 1M Context | Video Optimized
const MODEL_NAME = 'gemini-2.5-flash-lite';
const MIN_DELAY_MS = 2000; // conservative backoff for safety
let lastCallTime = 0;

export const GemininService = {
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    if (timeSinceLastCall < MIN_DELAY_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS - timeSinceLastCall));
    }
    lastCallTime = Date.now();
  },

  async retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as Error;
      const msg = err?.message?.toLowerCase() || '';

      // Handle Overloaded (503), Rate Limited (429), or Network Errors (Fetch failed)
      const isQuota = msg.includes('quota');
      const isNetwork = msg.includes('fetch failed') || msg.includes('network error');
      const isRetryable =
        msg.includes('503') || msg.includes('overloaded') || msg.includes('429') || isNetwork;

      if (!isQuota && retries > 0 && isRetryable) {
        if (process.env.NODE_ENV === 'development')
          console.warn(`Gemini Retry (${retries} left): ${msg}`);
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
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const { totalTokens } = await model.countTokens(text);
    return totalTokens;
  },

  async analyzeTranscript(
    apiKey: string,
    transcript: string,
    mode: 'video' | 'text' = 'video',
    videoDuration?: number,
  ): Promise<TaskItem[]> {
    await this.enforceRateLimit();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: 'application/json' },
    });

    // Prompt Logic based on Mode
    const promptRules =
      mode === 'text'
        ? `TEXT MODE: Source is raw text. SET "timestamp_seconds": 0 for all tasks.`
        : `VIDEO MODE: Identify timestamps where new topics begin.`;

    const prompt = `
            You are an expert Instructional Designer creating a "Recipe for Life" guide for high school students.
            Your goal is to turn the raw transcript below into a logical, step-by-step Action Plan.

            RULES FOR TASKS:
            1. **Granularity:** Break the content into 4-8 distinct "Modules" or "Steps."
            2. **Naming:** Task names must be Action Verbs (e.g., "Scrape Leads" instead of "Scraping").
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
      const result = await this.retryWithBackoff(() =>
        this.withTimeout(model.generateContent(prompt)),
      );

      // 🛡️ IRON DOME: Use Centralized Safe Parser
      const tasks = safeParseTasks(result.response.text());

      // ⚡️ STRICT ORDERING: Force sort by time to prevent "Time Traveling" tasks
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

      // Check for Safety Block (GoogleGenerativeAI Error)
      if (err?.message?.includes('SAFETY') || err?.message?.includes('blocked')) {
        throw new Error('Safety Block: Content violates AI safety guidelines.');
      }

      // safeParseTasks throws Error, which we catch here
      throw error;
    }
  },

  async generateSearchQueries(apiKey: string, topic: string): Promise<string[]> {
    await this.enforceRateLimit();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: 'application/json' },
    });

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
      const result = await this.retryWithBackoff(() =>
        this.withTimeout(model.generateContent(prompt)),
      );
      // 🛡️ IRON DOME: Use Centralized Safe Parser
      return safeParseSearchQueries(result.response.text());
    } catch (e: unknown) {
      const err = e as Error;
      console.warn('Scout Fail:', err);

      // Check for Safety Block or specific known errors
      if (err?.message?.includes('SAFETY') || err?.message?.includes('blocked')) {
        throw new Error('Safety Block: Topics violate safety guidelines.');
      }
      // Propagate error so UI can show Toast
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
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: 'application/json' },
    });

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
      const result = await this.retryWithBackoff(() =>
        this.withTimeout(model.generateContent(prompt)),
      );
      return safeParseSubSteps(result.response.text());
    } catch (e) {
      console.warn('SubStep Fail:', e);
      return [];
    }
  },
};
