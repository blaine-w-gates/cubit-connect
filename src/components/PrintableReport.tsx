import { useEffect, useState } from 'react';
import { TaskItem } from '@/services/storage';

interface PrintableReportProps {
    tasks: TaskItem[];
    projectTitle: string;
    projectType?: 'video' | 'text';
}

// React 19: 'ref' is available as a prop
export const PrintableReport = ({ tasks, projectTitle, projectType, ref }: PrintableReportProps & { ref?: React.Ref<HTMLDivElement> }) => {
    const [dateString, setDateString] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
        setDateString(new Date().toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }));
    }, []);

    if (!mounted) return null;

    return (
        <div ref={ref} className="bg-white dark:bg-stone-900 text-black dark:text-stone-200 font-serif print:bg-white print:text-black">
            <style type="text/css" media="print">
                {`
                    @page { size: auto; margin: 15mm 20mm; }
                    body { -webkit-print-color-adjust: exact; }
                    .print-task-card {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                `}
            </style>

            <div className="max-w-[210mm] mx-auto p-8 space-y-8">
                {/* Header */}
                <header className="border-b-2 border-black pb-6 mb-10 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 tracking-tight">{projectTitle}</h1>
                        <p className="text-sm text-gray-500 uppercase tracking-widest font-sans">Distilled Knowledge Report</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-black font-sans">CUBIT CONNECT</p>
                        <p className="text-xs text-gray-500 font-sans">{dateString}</p>
                    </div>
                </header>

                <div className="space-y-10">
                    {tasks.map((task, index) => (
                        <div key={task.id} className="print-task-card mb-8 break-inside-avoid">
                            <div className="grid grid-cols-12 gap-6">
                                {/* Left Column: Visual Evidence (Video Mode Only) */}
                                {projectType !== 'text' && (
                                    <div className="col-span-4">
                                        {task.screenshot_base64 ? (
                                            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-zinc-700 print:border-gray-300 bg-gray-50 dark:bg-zinc-800">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={task.screenshot_base64}
                                                    alt={`Screenshot for ${task.task_name}`}
                                                    className="w-full h-auto object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <div className="h-full border-r-2 border-dashed border-gray-100 dark:border-zinc-800 min-h-[100px]" />
                                        )}
                                    </div>
                                )}

                                {/* Right Column: Content (Adapts to Mode) */}
                                <div className={projectType === 'text' ? "col-span-12" : "col-span-8"}>
                                    <div className="flex gap-4 items-baseline mb-2 bg-gray-50 dark:bg-zinc-800/50 p-2 rounded border border-gray-100 dark:border-zinc-700 print:bg-gray-50 print:border-gray-200">
                                        <span className="font-mono text-xl font-bold text-gray-400 dark:text-zinc-600">#{String(index + 1).padStart(2, '0')}</span>
                                        <h2 className="text-2xl font-bold flex-1 leading-tight text-gray-900 dark:text-stone-200 print:text-black">
                                            {task.task_name}
                                        </h2>
                                        {task.timestamp_seconds > 0 && (
                                            <span className="text-xs font-mono text-gray-500 dark:text-zinc-500 border border-gray-300 dark:border-zinc-600 px-1.5 py-0.5 rounded">
                                                {formatTime(task.timestamp_seconds)}
                                            </span>
                                        )}
                                    </div>

                                    <blockquote className="text-gray-600 dark:text-zinc-400 mb-6 italic pl-4 border-l-4 border-gray-200 dark:border-zinc-700 py-1 text-sm print:text-gray-600 print:border-gray-200">
                                        {task.description}
                                    </blockquote>

                                    {/* Level 2: Sub-steps */}
                                    {task.sub_steps && task.sub_steps.length > 0 && (
                                        <div className="space-y-4 pl-2">
                                            {task.sub_steps.map((step, sIdx) => (
                                                <div key={step.id || sIdx} className="group">
                                                    <div className="flex items-start gap-3">
                                                        {/* Checkbox for Print */}
                                                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-zinc-600 flex-shrink-0 mt-0.5 print:border-gray-400" />

                                                        <div className="flex-1">
                                                            <div className="font-medium text-gray-900 dark:text-zinc-200 leading-snug print:text-black">
                                                                {step.text}
                                                            </div>

                                                            {/* Level 3: Micro-steps */}
                                                            {step.sub_steps && step.sub_steps.length > 0 && (
                                                                <ul className="mt-2 space-y-1.5 pl-1 border-l border-gray-200/50 dark:border-zinc-700/50">
                                                                    {step.sub_steps.map((micro: unknown, mIdx: number) => (
                                                                        <li key={mIdx} className="text-sm text-gray-600 dark:text-zinc-400 flex gap-2 items-start pl-3 print:text-gray-600">
                                                                            <span className="text-gray-400 dark:text-zinc-600 text-[10px] pt-1">•</span>
                                                                            <span>{typeof micro === 'string' ? micro : (micro as { text: string }).text}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer for Print */}
                <footer className="mt-12 pt-8 border-t border-gray-200 text-center text-xs text-gray-400 font-sans print:fixed print:bottom-4 print:left-0 print:right-0 print:w-full">
                    Generated by Cubit Connect • Private & Local Data
                </footer>
            </div>
        </div>
    );
};



// Utilities
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
