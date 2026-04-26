import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskItem } from './storage';
import { safeParseTasks, safeParseSearchQueries, safeParseSubSteps } from '@/lib/validation';
import {
  transcriptAnalysisPrompt,
  subStepsPrompt,
  searchQueriesPrompt,
  testPrompt,
} from '@/prompts';

// MODELS
const PRIMARY_MODEL = 'gemini-2.5-flash-lite';
const FALLBACK_MODEL = 'gemini-2.5-flash';

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
    new CustomEvent('gemini-log', {
      detail: { message, type, timestamp: new Date().toLocaleTimeString() },
    }),
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

  async retryWithBackoff<T>(
    fn: (modelName: string) => Promise<T>,
    retries = 3,
    delay = 2000,
  ): Promise<T> {
    let currentRetries = retries;
    let currentDelay = delay;

    while (true) {
      // 1. Determine which model to start with
      const currentModel = this.isPrimaryCool() ? PRIMARY_MODEL : FALLBACK_MODEL;

      // Log the start if it's the first attempt (heuristic)
      if (currentRetries === 3) {
        // emitLog(`Starting generation with ${currentModel}...`, 'info');
        // Commented out to reduce noise, we only log switches.
      }

      try {
        return await fn(currentModel);
      } catch (error: unknown) {
        // INTENTIONALLY HANDLING: Retry with fallback logic for rate limits/network errors
        // 429/quota errors trigger model switch, network errors retry, others propagate
        const err = error as Error;
        const msg = err?.message?.toLowerCase() || '';

        // 429 DETECTION & FALLBACK LOGIC
        if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
          // Scenario A: We are on PRIMARY and hit a limit.
          if (currentModel === PRIMARY_MODEL) {
            primaryCooldownUntil = Date.now() + COOLDOWN_DURATION;
            emitLog(
              `⚠️ Rate Limit Hit on Primary. Cooling down... Switching to ${FALLBACK_MODEL}`,
              'warning',
            );

            // IMMEDIATE RETRY with Fallback (No backoff delay needed, just switch)
            // Continue loop with same retries count
            continue;
          }

          // Scenario B: We are already on FALLBACK and hit a limit.
          if (currentModel === FALLBACK_MODEL) {
            emitLog(`🔴 Project Quota Exceeded. Both models exhausted.`, 'error');
            throw new Error('PROJECT_QUOTA_EXCEEDED: Please update your API Key.');
          }
        }

        // Standard Retry Logic for Network Blips (503, etc)
        const isNetwork =
          msg.includes('fetch failed') || msg.includes('network error') || msg.includes('503');

        if (currentRetries > 0 && isNetwork) {
          if (process.env.NODE_ENV === 'development')
            console.warn(`Gemini Retry (${currentRetries} left): ${msg}`);

          await new Promise((resolve) => setTimeout(resolve, currentDelay));

          currentRetries--;
          currentDelay *= 2;
          continue;
        }

        // If we get here, it's a fatal error or retries exhausted
        throw error;
      }
    }
  },

  async withTimeout<T>(promise: Promise<T>, ms: number = 20000): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Request Timed Out (${ms/1000}s)`)), ms);
    });
    return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeoutPromise]);
  },

  async validateConnection(apiKey: string): Promise<boolean> {
    try {
      await this.countTokens(apiKey, 'Test connection');
      return true;
    } catch {
      // INTENTIONALLY PROPAGATING: Connection validation failure
      // Re-throw with user-friendly message for settings dialog
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
    mode: 'video' | 'text' | 'scout' = 'video',
    videoDuration?: number,
  ): Promise<TaskItem[]> {
    await this.enforceRateLimit();
    const genAI = new GoogleGenerativeAI(apiKey);

    // 0. CONTEXT CHECK (Safety Valve for Lite)
    // If transcript is huge (>25k tokens approx 100k chars), force Primary Model or fail if Primary is hot.
    // We act conservatively: If > 100,000 chars, we assume it's too big for Lite.
    const isHugeContext = transcript.length > 100000;

    if (isHugeContext && !this.isPrimaryCool()) {
      // Ideally we wait, but for now we just warn and try Primary anyway?
      // No, if Primary is cool, we use it. If Primary is HOT (rate limited) and we try Fallback, Fallback will crash.
      // So if Primary is HOT and Context is HUGE -> We must FAIL fast to save user time.
      throw new Error(
        'PROJECT_QUOTA_EXCEEDED: Content too large for backup model. Please upgrade or wait.',
      );
    }

    const prompt = transcriptAnalysisPrompt(
      transcript,
      mode as 'video' | 'text',
      videoDuration,
    );

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
        isExpanded: false,
        sub_steps: [],
      }));
    } catch (error: unknown) {
      // INTENTIONALLY HANDLING: Transform safety errors to user-friendly messages
      // Re-throw other errors (network, auth) for upstream handling
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

    const prompt = searchQueriesPrompt(topic);
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
      // INTENTIONALLY TRANSFORMING: Convert safety errors to user-friendly messages
      // Re-throws other errors for upstream handling
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

    const prompt = subStepsPrompt(instruction, transcript, neighborContext);
    try {
      const result = await this.retryWithBackoff(async (modelName) => {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: 'application/json' },
        });
        // Substeps generation can be complex, use 35s timeout
        return this.withTimeout(model.generateContent(prompt), 35000);
      });
      return safeParseSubSteps(result.response.text());
    } catch (e: unknown) {
      // INTENTIONALLY LOGGING AND RE-THROWING: Log for debugging, pass to UI handler
      // All errors re-thrown for upstream handling with specific error messages
      const err = e as Error;
      console.warn('SubStep Fail:', err);
      if (err.message?.includes('PROJECT_QUOTA_EXCEEDED')) {
        throw err;
      }
      throw err;
    }
  },

  async generateTestContent(
    apiKey: string,
    modelName: string,
    systemInstruction: string,
    userPrompt: string,
  ): Promise<string> {
    await this.enforceRateLimit();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
    });
    const result = await this.withTimeout(model.generateContent(userPrompt));
    return result.response.text();
  },

  // Model comparison test - returns timing results
  async compareModels(apiKey: string): Promise<{lite: number, full: number, winner: string}> {
    const prompt = testPrompt();
    
    // Test lite model
    const liteStart = Date.now();
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const liteModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        generationConfig: { responseMimeType: 'application/json' },
      });
      await this.withTimeout(liteModel.generateContent(prompt), 15000);
    } catch {
      // INTENTIONALLY IGNORING: Lite model test is timing comparison only
      // Failure doesn't invalidate the API key, just means lite model unavailable
    }
    const liteTime = Date.now() - liteStart;
    
    await this.enforceRateLimit();
    
    // Test full model
    const fullStart = Date.now();
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const fullModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });
      await this.withTimeout(fullModel.generateContent(prompt), 15000);
    } catch {
      // INTENTIONALLY IGNORING: Full model test is timing comparison only
      // Failure doesn't invalidate the API key, just means full model unavailable
    }
    const fullTime = Date.now() - fullStart;
    
    return {
      lite: liteTime,
      full: fullTime,
      winner: liteTime < fullTime ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash'
    };
  },
};
