import { GoogleGenerativeAI } from '@google/generative-ai';

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
        return text.replace(/```json/g, '').replace(/```/g, '').trim();
    },

    async retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
        try {
            return await fn();
        } catch (error: any) {
            if (retries > 0 && (error?.message?.includes('503') || error?.message?.includes('overloaded'))) {
                console.warn(`Gemini 503 Overloaded. Retrying in ${delay}ms... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.retryWithBackoff(fn, retries - 1, delay * 2);
            }
            throw error;
        }
    },

    async analyzeTranscript(apiKey: string, transcriptText: string, modelName: string = "gemini-2.5-flash-lite") {
        await this.enforceRateLimit();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = `
      You are an expert video analyst. 
      Analyze the transcript. Extract "Tasks".
      RETURN ONLY JSON ARRAY.
      Format: [{ "task_name": "...", "timestamp_seconds": 12.5, "description": "..." }]
      TRANSCRIPT: ${transcriptText.substring(0, 30000)}
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

    async generateSubSteps(apiKey: string, taskName: string, context: string) {
        await this.enforceRateLimit();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        const prompt = `Break "${taskName}" into 4 sub-steps. JSON Array of strings only.`;
        const result = await this.retryWithBackoff(() => model.generateContent(prompt));
        return JSON.parse(this.cleanJson(result.response.text()));
    }
};
