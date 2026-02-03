"use client";

import { useState } from 'react';
import { Copy, Download, Check } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { generateMarkdown, getSafeFilename } from '@/utils/exportUtils';

export default function ExportMenu() {
    const { tasks, projectTitle } = useAppStore();
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const md = generateMarkdown(tasks, projectTitle);
        try {
            await navigator.clipboard.writeText(md);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    const handleDownload = () => {
        const md = generateMarkdown(tasks, projectTitle);
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getSafeFilename(projectTitle);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (tasks.length === 0) return null;

    return (
        <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md p-2 rounded-xl border border-white/5 shadow-xl">
            {/* Copy Button */}
            <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-all"
                title="Copy Markdown to Clipboard"
            >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
            </button>

            <div className="w-px h-6 bg-zinc-700 mx-1" />

            {/* Download Button */}
            <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 text-sm font-medium transition-all"
                title="Download .md File"
            >
                <Download className="w-4 h-4" />
                Download
            </button>
        </div>
    );
}
