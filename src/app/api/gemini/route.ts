import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, prompt, text, modelName } = body;

        // Security: The API key is now strictly read from the confidential Server Environment
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('CRITICAL: GEMINI_API_KEY is not defined in environment variables.');
            return NextResponse.json({ error: 'Server configuration error: Gemini API Key missing.' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        if (action === 'countTokens') {
            const model = genAI.getGenerativeModel({ model: modelName });
            const { totalTokens } = await model.countTokens(text);
            return NextResponse.json({ totalTokens });
        }

        if (action === 'generateContent') {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: 'application/json' },
            });

            const result = await model.generateContent(prompt);
            return NextResponse.json({ responseText: result.response.text() });
        }

        if (action === 'sandboxGenerate') {
            const { systemInstruction, contents } = body;
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction,
            });
            const result = await model.generateContent(contents);
            return NextResponse.json({ responseText: result.response.text() });
        }

        if (action === 'listModels') {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
            const data = await response.json();
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: 'Invalid action specified.' }, { status: 400 });
    } catch (error: unknown) {
        console.error('Gemini API Route Error:', error);
        const err = error as Error;
        const msg = err.message || 'Unknown error';

        let status = 500;
        const msgLower = msg.toLowerCase();
        if (msgLower.includes('429') || msgLower.includes('quota') || msgLower.includes('resource_exhausted')) status = 429;
        if (msgLower.includes('503') || msgLower.includes('overloaded')) status = 503;
        if (msgLower.includes('safety') || msgLower.includes('blocked')) status = 403;

        return NextResponse.json({ error: msg }, { status });
    }
}
