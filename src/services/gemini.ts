import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskItem } from './storage';

const MODEL_NAME = "gemini-2.5-flash-lite"; // Standard 2026 Production Model
const MIN_DELAY_MS = 2000;
let lastCallTime = 0;

export const GemininService = {
    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime;
        if (timeSinceLastCall < MIN_DELAY_MS) {
            await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - timeSinceLastCall));
        }
        lastCallTime = Date.now();
    },

    cleanJson(text: string): string {
        // Aggressively find the JSON array
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
            return text.substring(start, end + 1);
        }
        return text.replace(/```json/g, '').replace(/```/g, '').trim();
    },

    async retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
        try {
            return await fn();
        } catch (error: any) {
            if (retries > 0 && (error?.message?.includes('503') || error?.message?.includes('overloaded') || error?.message?.includes('429'))) {
                console.warn(`Gemini Overloaded. Retrying in ${delay}ms... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.retryWithBackoff(fn, retries - 1, delay * 2);
            }
            if (error?.message?.includes('503') || error?.message?.includes('429')) {
                throw new Error("OVERLOADED");
            }
            throw error;
        }
    },

    async analyzeTranscript(apiKey: string, transcript: string): Promise<TaskItem[]> {
        await this.enforceRateLimit();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
      You are an expert video analyst. 
      Analyze the transcript. Extract "Tasks".
      Format: [{ "task_name": "...", "timestamp_seconds": 12.5, "description": "..." }]
      RULES:
      1. Identify the core main tasks/topics from the video (typically 3-10 depending on complexity). Do not artificially limit the number if the content requires more.
      2. Return strictly a JSON array.
      TRANSCRIPT: ${transcript.substring(0, 30000)}
    `;

        try {
            const result = await this.retryWithBackoff(() => model.generateContent(prompt));
            const text = this.cleanJson(result.response.text());
            const tasks = JSON.parse(text);
            return tasks.map((t: any) => ({ ...t, id: crypto.randomUUID(), screenshot_base64: "" }));
        } catch (error) {
            console.error("Gemini Error:", error);
            throw error;
        }
    },

    async generateSubSteps(apiKey: string, taskName: string, context: string, fullTranscript?: string): Promise<string[]> {
        await this.enforceRateLimit();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: { responseMimeType: "application/json" }
        });

        // Prompt Logic: If full transcript exists, use it.
        const transcriptContext = fullTranscript
            ? `FULL VIDEO TRANSCRIPT: \n"${fullTranscript.substring(0, 50000)}..."\n\n`
            : "";

        const prompt = `
      You are an expert video analyst and productivity coach. 
      ${transcriptContext}
      CONTEXT TASK: "${taskName}"
      SPECIFIC GOAL TO BREAK DOWN: "${context}"
      
      ACTION: Break down the "SPECIFIC GOAL" into exactly 4 actionable, concrete steps.
      
      RULES:
      1. Steps must be actionable and SPECIFIC to the provided TRANSCRIPT (if available). Quote specific advice or details from the speaker if relevant.
      2. If no transcript is provided, use general best practices but keep it specific to the goal.
      3. Return ONLY a JSON array of 4 strings.
      4. example: ["Identify 'limiting beliefs' mentioned in video", "Draft email using the 'ABC' method", "Review footage for 'glitch' effect"]
    `;

        try {
            const result = await this.retryWithBackoff(() => model.generateContent(prompt));
            const rawText = result.response.text();
            console.log("Gemini Raw Response:", rawText); // Debug logging
            const text = this.cleanJson(rawText);
            return JSON.parse(text);
        } catch (error: any) {
            console.error("Gemini Sub-step Error:", error);
            return [];
        }
    },

    async listAvailableModels(apiKey: string) {
        try {
            // Using fetch directly because listModels might not be exposed easily in this SDK version
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const data = await response.json();
            console.log(">>> AVAILABLE GEMINI MODELS <<<");
            console.log(data.models?.map((m: any) => `${m.name} | ${m.version} | ${m.displayName}`));
            console.log(">>> END MODEL LIST <<<");
        } catch (e) {
            console.error("Failed to list models", e);
        }
    }
};
