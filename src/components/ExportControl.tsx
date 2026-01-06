import { useRef, ChangeEvent, useState } from 'react';
import { Download, Upload, Printer, Copy, Check } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { TaskItem } from '@/services/storage';

interface ExportControlProps {
    onPrint?: () => void;
}

export default function ExportControl({ onPrint }: ExportControlProps) {
    const { tasks, importTasks } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [copied, setCopied] = useState(false);

    const handleCopyMarkdown = async () => {
        if (tasks.length === 0) return;

        let md = `# Cubit Connect Report\nGenerated: ${new Date().toLocaleDateString()}\n\n`;

        tasks.forEach((task, i) => {
            // Level 1
            md += `## ${i + 1}. ${task.task_name}\n`;
            md += `> ${task.description}\n\n`;

            // Level 2
            task.sub_steps?.forEach((step, j) => {
                md += `* **${i + 1}.${j + 1} ${step.text}**\n`;

                // Level 3
                step.sub_steps?.forEach((micro) => {
                    const text = typeof micro === 'string' ? micro : micro.text;
                    md += `  * ${text}\n`;
                });
                md += `\n`;
            });
            md += `\n---\n\n`;
        });

        try {
            await navigator.clipboard.writeText(md);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    const handleExport = () => {
        if (tasks.length === 0) return;

        const dataStr = JSON.stringify(tasks, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // Formatting date for filename
        const date = new Date().toISOString().split('T')[0];
        const link = document.createElement('a');
        link.href = url;
        link.download = `cubit-project-${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const data = JSON.parse(text);

                // Basic Validation
                if (!Array.isArray(data)) {
                    alert("Invalid backup file: Not an array.");
                    return;
                }

                // Check first item structure roughly
                if (data.length > 0 && (!data[0].id || !data[0].task_name)) {
                    alert("Invalid backup file: Data structure mismatch.");
                    return;
                }

                if (confirm(`Replace current project with ${data.length} tasks from backup?`)) {
                    await importTasks(data as TaskItem[]);
                    alert("Project restored successfully.");
                }

            } catch (err) {
                console.error("Import Failed", err);
                alert("Failed to parse backup file.");
            }

            // Reset input so same file can be selected again if needed
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={handleCopyMarkdown}
                disabled={tasks.length === 0}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Copy Markdown for AI"
            >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'MD'}</span>
            </button>
            <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

            {onPrint && (
                <>
                    <button
                        onClick={onPrint}
                        disabled={tasks.length === 0}
                        className="flex items-center gap-2 text-xs text-zinc-400 hover:text-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Print PDF"
                    >
                        <Printer className="w-4 h-4" />
                        <span className="hidden sm:inline">PDF</span>
                    </button>
                    <div className="h-4 w-[1px] bg-zinc-800 mx-1" />
                </>
            )}

            <button
                onClick={handleExport}
                disabled={tasks.length === 0}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download Backup"
            >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Backup</span>
            </button>

            <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

            <label className="flex items-center gap-2 text-xs text-zinc-400 hover:text-green-400 transition-colors cursor-pointer" title="Restore Backup">
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Restore</span>
                <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImport}
                />
            </label>
        </div>
    );
}
