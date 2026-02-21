'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Play, AlertCircle, CheckCircle2 } from 'lucide-react';

const MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', role: 'The New Workhorse' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', role: 'The Rolling Edge' },
  {
    id: 'gemini-2.5-flash-lite-preview-09-2025',
    name: 'Gemini 2.5 Flash Lite',
    role: 'The Future Lite',
  },
  {
    id: 'gemini-flash-lite-latest',
    name: 'Gemini Flash Lite Latest',
    role: 'The Efficiency Standard',
  },
];

interface ModelResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  statusCode?: number;
  latency?: number;
  output?: string;
  errorMsg?: string;
}

export default function SandboxPage() {
  const [systemPrompt, setSystemPrompt] = useState('You are a concise diagnostic computer.');
  const [userPrompt, setUserPrompt] = useState('Identify yourself. State your model version.');
  const [results, setResults] = useState<Record<string, ModelResult>>({});
  const [scanResult, setScanResult] = useState<string>('');

  useEffect(() => {
    // Initialize results state
    const initialResults: Record<string, ModelResult> = {};
    MODELS.forEach((m) => {
      initialResults[m.id] = { status: 'idle' };
    });
    setResults(initialResults);
  }, []);

  const handleIgnite = async () => {
    // Reset states to loading
    const loadingState: Record<string, ModelResult> = {};
    MODELS.forEach((m) => {
      loadingState[m.id] = { status: 'loading' };
    });
    setResults(loadingState);

    // Fire requests in parallel but handle independently
    MODELS.forEach((model) => {
      testModel(model.id);
    });
  };

  const testModel = async (modelId: string) => {
    const startTime = performance.now();
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sandboxGenerate',
          modelName: modelId,
          systemInstruction: systemPrompt,
          contents: [{ parts: [{ text: userPrompt }] }],
        }),
      });

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      const data = await response.json();

      if (!response.ok) {
        setResults((prev) => ({
          ...prev,
          [modelId]: {
            status: 'error',
            statusCode: response.status,
            latency,
            errorMsg: data.error?.message || response.statusText,
            output: JSON.stringify(data, null, 2),
          },
        }));
        return;
      }

      const text = data.responseText || JSON.stringify(data, null, 2);

      setResults((prev) => ({
        ...prev,
        [modelId]: {
          status: 'success',
          statusCode: response.status,
          latency,
          output: text,
        },
      }));
    } catch (error: unknown) {
      const endTime = performance.now();
      const errorMessage = error instanceof Error ? error.message : 'Network Error';
      setResults((prev) => ({
        ...prev,
        [modelId]: {
          status: 'error',
          statusCode: 0,
          latency: Math.round(endTime - startTime),
          errorMsg: errorMessage,
        },
      }));
    }
  };

  const handleScan = async () => {
    setScanResult('Scanning network for available models...');
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listModels' })
      });
      const data = await response.json();
      if (data.models) {
        const filtered = data.models
          .filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (m: any) => m.supportedGenerationMethods?.includes('generateContent'),
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((m: any) => ({
            name: m.name,
            version: m.version,
            displayName: m.displayName,
          }));
        setScanResult(JSON.stringify(filtered, null, 2));
      } else {
        setScanResult(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      setScanResult(
        `Error scanning network: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-mono selection:bg-red-900 selection:text-white">
      {/* Header */}
      <header className="mb-8 border-b border-zinc-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tighter text-red-500 uppercase">
          CUBIT MODEL SANDBOX <span className="text-zinc-600">{'//'}</span> CLASSIFIED
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Diagnostic Proving Grounds</p>
      </header>

      {/* Control Panel */}
      <section className="mb-8 bg-zinc-900/50 p-6 rounded-lg border border-zinc-800">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-2">
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded text-sm focus:border-red-500 focus:outline-none transition-colors h-24 font-mono resize-none"
              />
            </div>
          </div>

          <div className="space-y-4 flex flex-col">
            <div className="flex-grow">
              <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-2">
                User Prompt
              </label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded text-sm focus:border-red-500 focus:outline-none transition-colors h-[138px] font-mono resize-none"
              />
            </div>
            <button
              onClick={handleIgnite}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <Play className="w-4 h-4 fill-current" />
              Ignite Sequence
            </button>
            <button
              onClick={handleScan}
              className="mt-2 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <span className="w-4 h-4">📡</span>
              Scan Network
            </button>
          </div>
        </div>
      </section>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODELS.map((model) => {
          const result = results[model.id] || { status: 'idle' };

          let borderColor = 'border-zinc-800';
          let statusColor = 'text-zinc-500';

          if (result.status === 'success') {
            borderColor = 'border-green-900/50';
            statusColor = 'text-green-500';
          } else if (result.status === 'error') {
            borderColor = 'border-red-900/50';
            statusColor = 'text-red-500';
          } else if (result.status === 'loading') {
            borderColor = 'border-yellow-900/50';
            statusColor = 'text-yellow-500';
          }

          return (
            <div
              key={model.id}
              className={`bg-zinc-900 border ${borderColor} p-4 rounded-lg relative overflow-hidden transition-colors`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-zinc-100">{model.name}</h3>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">{model.role}</p>
                </div>
                <div className="text-right">
                  <div
                    className={`font-mono text-sm font-bold flex items-center gap-2 justify-end ${statusColor}`}
                  >
                    {result.status === 'loading' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {result.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                    {result.status === 'error' && <AlertCircle className="w-3 h-3" />}
                    {result.status === 'idle'
                      ? 'STANDBY'
                      : result.statusCode
                        ? `${result.statusCode}`
                        : result.status.toUpperCase()}
                  </div>
                  {result.latency !== undefined && (
                    <div className="text-xs text-zinc-600 font-mono mt-1">{result.latency}ms</div>
                  )}
                </div>
              </div>

              <div className="bg-zinc-950 p-3 rounded border border-zinc-800/50 h-48 overflow-y-auto font-mono text-xs custom-scrollbar">
                {result.status === 'idle' && (
                  <span className="text-zinc-700 italic">Ready for ignition...</span>
                )}
                {result.status === 'loading' && (
                  <span className="text-zinc-500 animate-pulse">Establishing connection...</span>
                )}
                {result.status === 'success' && (
                  <pre className="whitespace-pre-wrap text-zinc-300">{result.output}</pre>
                )}
                {result.status === 'error' && (
                  <div className="text-red-400">
                    <p className="font-bold mb-1">ERROR:</p>
                    <pre className="whitespace-pre-wrap">{result.errorMsg}</pre>
                    {result.output && (
                      <pre className="mt-2 text-zinc-600 border-t border-zinc-800 pt-2">
                        {result.output}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Terminal Output */}
      {scanResult && (
        <div className="mt-8 bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
          <h3 className="text-zinc-500 text-xs uppercase tracking-wider mb-2">
            Network Scan Results
          </h3>
          <pre className="bg-zinc-950 p-4 rounded overflow-x-auto text-xs text-green-400 font-mono border border-zinc-800/50">
            {scanResult}
          </pre>
        </div>
      )}
    </div>
  );
}
