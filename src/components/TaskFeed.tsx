import { Virtuoso } from 'react-virtuoso';
import { TaskItem } from '@/services/storage';
import { useAppStore } from '@/store/useAppStore';

import { ChevronDown, ChevronRight, Wand2 } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import { EditableText } from '@/components/ui/EditableText';

interface TaskFeedProps {
    tasks: TaskItem[];
    // onCubit: taskId, prompt/context, optional stepId (if Deep Dive)
    onCubit: (taskId: string, context: string, stepId?: string) => void;
}

// Simple time formatter (MM:SS)
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function TaskFeed({ tasks, onCubit }: TaskFeedProps) {
    // Virtualization requires fixed height or pure item rendering
    // We will render the whole page height for the feed eventually, 
    // but for now let's give it a container.

    return (
        <div className="h-full w-full bg-transparent">
            <Virtuoso
                style={{ height: 'calc(100vh - 80px)' }} // Subtract header height approx
                className="no-scrollbar" // Optional: custom scrollbar hiding if needed
                data={tasks}
                itemContent={(index, task) => <TaskRow task={task} onCubit={onCubit} />}
            />
        </div>
    );
}

function TaskRow({ task, onCubit }: { task: TaskItem, onCubit: (id: string, name: string, desc?: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const { updateTask, updateDeepStep } = useAppStore();

    return (
        <div className="p-4 mb-3 mx-2 sm:mx-4 bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-xl hover:bg-zinc-900/60 transition-colors">
            <div className="flex gap-4 items-start">
                {/* Screenshot */}
                <div className="relative w-[120px] h-[67.5px] bg-zinc-800 rounded-md overflow-hidden flex-shrink-0 border border-zinc-700 shadow-sm">
                    {task.screenshot_base64 ? (
                        <Image
                            src={task.screenshot_base64}
                            alt={task.task_name}
                            fill
                            className="object-cover"
                            unoptimized
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 animate-pulse">
                            Processing...
                        </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                        {formatTime(task.timestamp_seconds)}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex-1 pr-2 truncate">
                            <EditableText
                                value={task.task_name}
                                onSave={(val) => updateTask(task.id, { task_name: val })}
                                className="text-base font-medium text-white block truncate"
                            />
                        </div>
                        <button
                            className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors flex-shrink-0"
                            // Main Task Cubit (Level 1 -> 2)
                            onClick={() => onCubit(task.id, `Task: ${task.task_name}. Description: ${task.description}`, undefined)}
                        >
                            <Wand2 className="w-3 h-3" />
                            Cubit
                        </button>
                    </div>

                    <EditableText
                        value={task.description}
                        onSave={(val) => updateTask(task.id, { description: val })}
                        className="text-sm text-zinc-400"
                        multiline
                    />

                    {/* Sub-steps Accordion Trigger */}
                    {task.sub_steps && task.sub_steps.length > 0 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="mt-2 text-xs text-zinc-500 flex items-center gap-1 hover:text-zinc-300"
                        >
                            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            {task.sub_steps.length} Steps Generated
                        </button>
                    )}
                </div>
            </div>

            {/* Accordion Body (Level 2: Sub-steps) */}
            {expanded && task.sub_steps && (
                <div className="mt-3 ml-[136px] bg-zinc-900/50 rounded-lg p-3 text-sm text-zinc-300 space-y-4 border border-zinc-800">
                    {task.sub_steps.map((step, idx) => (
                        <div key={step.id || idx} className="space-y-2">
                            <div className="flex items-start justify-between gap-2 group">
                                <div className="flex gap-2 flex-1">
                                    <span className="text-zinc-500 font-mono text-xs mt-1.5">{idx + 1}.</span>
                                    <div className="flex-1">
                                        <EditableText
                                            value={step.text}
                                            onSave={(val) => updateDeepStep(task.id, step.id, val)}
                                            className="text-zinc-300"
                                        />
                                    </div>
                                </div>
                                {/* Recrusive Cubit Button (Level 2 -> 3) */}
                                <button
                                    // Deep Dive (Level 2 -> 3) - Pass step.id
                                    onClick={() => onCubit(task.id, `Context: ${task.description}. Step: ${step.text}. Break this step down into 4 micro-steps.`, step.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] flex items-center gap-1 text-purple-400/80 hover:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded"
                                >
                                    <Wand2 className="w-3 h-3" />
                                    Deep Dive
                                </button>
                            </div>

                            {/* Deep Level (Level 3: Micro-steps) */}
                            {step.sub_steps && step.sub_steps.length > 0 && (
                                <div className="ml-6 pl-3 border-l-2 border-zinc-800 space-y-1">
                                    {step.sub_steps.map((micro, mIdx) => (
                                        <div key={mIdx} className="text-xs text-zinc-400 flex gap-2">
                                            <span className="text-zinc-600 font-mono">{String.fromCharCode(97 + mIdx)}.</span>
                                            <span>{typeof micro === 'string' ? micro : micro.text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
