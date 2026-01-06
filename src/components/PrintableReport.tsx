import { forwardRef } from 'react';
import { TaskItem, CubitStep } from '@/services/storage';

interface PrintableReportProps {
    tasks: TaskItem[];
}

export const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(({ tasks }, ref) => {
    return (
        <div ref={ref} className="p-8 bg-white text-black hidden print:block">
            <h1 className="text-3xl font-bold mb-4 border-b pb-2">Cubit Connect Report</h1>
            <p className="text-sm text-gray-500 mb-8">Generated on {new Date().toLocaleDateString()}</p>

            <div className="space-y-8">
                {tasks.map((task, index) => (
                    <div key={task.id} className="break-inside-avoid">
                        {/* Level 1: Main Task */}
                        <div className="flex gap-4 items-start mb-2">
                            <h2 className="text-xl font-bold flex-1">
                                {index + 1}. {task.task_name}
                            </h2>
                            <span className="text-sm font-mono text-gray-600 border px-1 rounded">
                                {formatTime(task.timestamp_seconds)}
                            </span>
                        </div>

                        {/* Screenshot */}
                        {task.screenshot_base64 && (
                            <img
                                src={task.screenshot_base64}
                                alt={`Screenshot for ${task.task_name}`}
                                className="w-full max-w-md my-4 border border-gray-300 rounded"
                            />
                        )}

                        <p className="text-gray-700 italic mb-4 pl-4 border-l-2 border-gray-200">
                            {task.description}
                        </p>

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
                        <hr className="my-6 border-gray-200" />
                    </div>
                ))}
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
