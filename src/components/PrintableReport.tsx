import { forwardRef, useEffect, useState } from 'react';
import { TaskItem, CubitStep } from '@/services/storage';

interface PrintableReportProps {
    tasks: TaskItem[];
}

export const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(({ tasks }, ref) => {
    const [dateString, setDateString] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setDateString(new Date().toLocaleDateString());
    }, []);

    if (!mounted) return null;

    return (
        <div ref={ref} className="bg-white text-black font-sans">
            <style type="text/css" media="print">
                {`
                    @page { size: auto; margin: 20mm; }
                    body { display: block !important; }
                    .print-task-card {
                        border: none !important;
                        background: transparent !important;
                        border-radius: 0 !important;
                        padding: 0 !important;
                        break-inside: auto !important;
                    }
                `}
            </style>

            <div className="max-w-4xl mx-auto p-4 space-y-8">
                <header className="border-b border-gray-200 pb-4 mb-8">
                    <h1 className="text-3xl font-bold mb-2">Cubit Connect Report</h1>
                    <p className="text-gray-500">Generated on {dateString}</p>
                </header>

                <div className="space-y-8">
                    {tasks.map((task, index) => (
                        <div key={task.id} className="print-task-card break-inside-avoid border border-gray-200 rounded-lg p-6 bg-gray-50 mb-8">
                            <div className="mb-4">
                                <div className="flex gap-4 items-start mb-2">
                                    <h2 className="text-xl font-bold flex-1">
                                        {index + 1}. {task.task_name}
                                    </h2>
                                    <span className="text-sm font-mono text-gray-600 border px-1 rounded">
                                        {formatTime(task.timestamp_seconds)}
                                    </span>
                                </div>
                                <p className="text-gray-600 mb-4">{task.description}</p>

                                {task.screenshot_base64 && (
                                    <div className="mb-4">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={task.screenshot_base64}
                                            alt={`Screenshot for ${task.task_name}`}
                                            className="rounded-lg border border-gray-200 max-h-[300px] w-auto object-contain bg-black"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Level 2: Sub-steps */}
                            {task.sub_steps && task.sub_steps.length > 0 && (
                                <div className="ml-6 space-y-3">
                                    {task.sub_steps.map((step, sIdx) => (
                                        <div key={step.id || sIdx}>
                                            <div className="font-semibold text-gray-800 flex gap-2">
                                                <span>{index + 1}.{sIdx + 1}</span>
                                                <span>{step.text}</span>
                                            </div>

                                            {/* Level 3: Micro-steps */}
                                            {step.sub_steps && step.sub_steps.length > 0 && (
                                                <ul className="ml-6 mt-1 list-disc text-sm text-gray-600 space-y-1">
                                                    {step.sub_steps.map((micro, mIdx) => (
                                                        <li key={mIdx}>
                                                            {typeof micro === 'string' ? micro : micro.text}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

PrintableReport.displayName = 'PrintableReport';

// Utilities
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
