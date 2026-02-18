'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { GeminiService } from '@/services/gemini';
import { toast } from 'sonner';

// --- Module-level constants (Fix #14: hoisted out of component) ---
const MODE_COLORS = {
    cubit: {
        bg: 'bg-cyan-100 dark:bg-cyan-950/30',
        ring: 'ring-cyan-400 dark:ring-cyan-500',
    },
    deepDive: {
        bg: 'bg-fuchsia-500/10 dark:bg-fuchsia-950/20',
        ring: 'ring-fuchsia-400 dark:ring-fuchsia-500',
    },
    dialLeft: {
        bg: 'bg-green-500/10 dark:bg-green-950/20',
        ring: 'ring-green-400 dark:ring-green-500',
    },
    dialRight: {
        bg: 'bg-yellow-500/10 dark:bg-yellow-950/20',
        ring: 'ring-yellow-400 dark:ring-yellow-500',
    },
} as const;

// Inline editable cell
function EditableCell({
    value,
    onSave,
    placeholder,
    disabled,
    autoFocus = false,
    className = '',
}: {
    value: string;
    onSave: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    className?: string;
}) {
    const [editing, setEditing] = useState(autoFocus);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    // Fix #5: Sync draft when parent value changes externally (e.g., Cubit overwrites steps)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!editing) setDraft(value);
    }, [value, editing]);

    const commit = () => {
        setEditing(false);
        if (draft !== value) onSave(draft);
    };

    // Auto-resize textarea
    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
        }
    }, [editing, draft]);

    if (editing) {
        return (
            <textarea
                ref={inputRef}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        commit();
                    }
                    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
                }}
                className={`w-full bg-transparent border-b border-zinc-400 dark:border-stone-500 outline-none text-sm px-1 py-0.5 resize-none max-h-[200px] overflow-y-auto ${className}`}
                placeholder={placeholder}
                rows={1}
            />
        );
    }

    return (
        <span
            onDoubleClick={() => {
                if (!disabled) {
                    setDraft(value);
                    setEditing(true);
                }
            }}
            onClick={() => {
                if (!disabled && !value.trim()) {
                    setDraft(value);
                    setEditing(true);
                }
            }}
            className={`block text-sm whitespace-pre-wrap break-words cursor-default ${!value ? 'text-zinc-400 dark:text-stone-600 italic' : ''} ${className}`}
        >
            {value || placeholder || '—'}
        </span>
    );
}

export default function TodoTable() {
    const {
        todoRows,
        activeMode,
        processingRowId,
        updateTodoCell,
        deleteTodoRow,
        setTodoSteps,
        insertTodoRowAfter,
        setDialPriority,
        moveTodoRowToBottom,
        setActiveMode,
        setProcessingRowId,
        restoreTodoRow,
        toggleTodoRowCompletion,
    } = useAppStore(
        useShallow((s) => ({
            todoRows: s.todoRows,
            activeMode: s.activeMode,
            processingRowId: s.processingRowId,
            updateTodoCell: s.updateTodoCell,
            deleteTodoRow: s.deleteTodoRow,
            setTodoSteps: s.setTodoSteps,
            insertTodoRowAfter: s.insertTodoRowAfter,
            setDialPriority: s.setDialPriority,
            moveTodoRowToBottom: s.moveTodoRowToBottom,
            setActiveMode: s.setActiveMode,
            setProcessingRowId: s.setProcessingRowId,
            restoreTodoRow: s.restoreTodoRow,
            toggleTodoRowCompletion: s.toggleTodoRowCompletion,
        })),
    );

    // Global Escape Key Listener (Safety Valve)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setActiveMode(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setActiveMode]);

    const apiKey = useAppStore((s) => s.apiKey);
    const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Swipe state (Fix #9: added startY for vertical guard)
    const swipeRef = useRef<{ startX: number; startY: number; rowId: string } | null>(null);

    const mc = activeMode ? MODE_COLORS[activeMode] : null;
    const isModeActive = activeMode !== null;
    const isTaskActionTarget = activeMode === 'cubit';
    const isStepActionTarget = ['deepDive', 'dialLeft', 'dialRight'].includes(activeMode || '');

    // --- Handlers ---

    const handleCubit = useCallback(async (rowId: string, taskText: string) => {
        if (!apiKey) return;
        if (!taskText.trim()) {
            toast.warning('Empty Task', { description: 'Type a task name before using Cubit.' });
            return;
        }
        setProcessingRowId(rowId);
        try {
            const rawSteps = await GeminiService.generateSubSteps(
                apiKey,
                `Task: "${taskText}". Generate exactly 4 actionable steps.`,
            );
            // Pad/truncate to exactly 4
            const steps: [string, string, string, string] = [
                rawSteps[0] || '',
                rawSteps[1] || '',
                rawSteps[2] || '',
                rawSteps[3] || '',
            ];
            setTodoSteps(rowId, steps);
            setActiveMode(null); // Reset to Neutral
        } catch (e) {
            const err = e as Error;
            toast.error('Cubit Failed', { description: err.message });
        } finally {
            setProcessingRowId(null);
        }
    }, [apiKey, setTodoSteps, setActiveMode, setProcessingRowId]);

    const handleDeepDive = useCallback(async (rowId: string, stepText: string, row: typeof todoRows[0]) => {
        if (!apiKey) return;
        if (!stepText.trim()) return;

        // Create new row below with step as task
        const newRowId = insertTodoRowAfter(rowId, stepText);

        // Auto-scroll to the new row after React renders it
        setTimeout(() => {
            document.getElementById(newRowId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);

        setProcessingRowId(newRowId);
        try {
            // Send sibling context
            const siblingContext = row.steps
                .filter((s) => s.trim())
                .map((s, i) => `Step ${i + 1}: "${s}"`)
                .join('\n');

            const rawSteps = await GeminiService.generateSubSteps(
                apiKey,
                `Deep Dive into: "${stepText}".\nSibling steps from parent row:\n${siblingContext}\nGenerate exactly 4 detailed sub-steps.`,
            );
            const steps: [string, string, string, string] = [
                rawSteps[0] || '',
                rawSteps[1] || '',
                rawSteps[2] || '',
                rawSteps[3] || '',
            ];
            setTodoSteps(newRowId, steps);
            setActiveMode(null); // Reset to Neutral
        } catch (e) {
            const err = e as Error;
            toast.error('Deep Dive Failed', { description: err.message });
        } finally {
            setProcessingRowId(null);
        }
    }, [apiKey, insertTodoRowAfter, setTodoSteps, setActiveMode, setProcessingRowId]);

    // Fix #1 & #2: Each branch resets independently. No trailing setActiveMode(null).
    // Read activeMode from getState() to avoid stale closure.
    const handleStepClick = useCallback((row: typeof todoRows[0], stepIdx: number) => {
        const stepText = row.steps[stepIdx];
        if (!stepText.trim()) return;

        const currentMode = useAppStore.getState().activeMode;

        if (currentMode === 'deepDive') {
            handleDeepDive(row.id, stepText, row);
            // handleDeepDive resets mode internally after async completion
        } else if (currentMode === 'dialLeft') {
            setDialPriority('left', stepText);
            setActiveMode(null); // Fire and Forget
        } else if (currentMode === 'dialRight') {
            setDialPriority('right', stepText);
            setActiveMode(null); // Fire and Forget
        }
    }, [handleDeepDive, setDialPriority, setActiveMode]);

    // Fix #3: Uses store action `restoreTodoRow` instead of direct setState
    const handleSwipeDelete = useCallback((rowId: string) => {
        const idx = todoRows.findIndex((r) => r.id === rowId);
        const row = todoRows[idx];
        if (!row) return;

        deleteTodoRow(rowId);

        // Clear previous timer
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

        toast('Task deleted', {
            action: {
                label: 'Undo',
                onClick: () => {
                    restoreTodoRow(row, idx);
                },
            },
            duration: 5000,
        });

        undoTimerRef.current = setTimeout(() => { /* undo window expired */ }, 5000);
    }, [todoRows, deleteTodoRow, restoreTodoRow]);

    const handleDoubleClickEmptyRow = useCallback((row: typeof todoRows[0]) => {
        const isEmpty = !row.task.trim() && row.steps.every((s) => !s.trim());
        if (isEmpty) moveTodoRowToBottom(row.id);
    }, [moveTodoRowToBottom]);

    // --- Touch swipe (Fix #9: vertical scroll guard) ---
    const handleTouchStart = (rowId: string, x: number, y: number) => {
        swipeRef.current = { startX: x, startY: y, rowId };
    };
    const handleTouchEnd = (x: number, y: number) => {
        if (!swipeRef.current) return;
        const dx = x - swipeRef.current.startX;
        const dy = y - swipeRef.current.startY;
        // Only trigger if horizontal movement dominates vertical
        if (Math.abs(dx) > 100 && Math.abs(dy) < Math.abs(dx)) {
            handleSwipeDelete(swipeRef.current.rowId);
        }
        swipeRef.current = null;
    };

    if (todoRows.length === 0) {
        return (
            <div className="border border-zinc-300 dark:border-stone-700 p-1 bg-[#FAFAFA] dark:bg-stone-950/50">
                <div className="border border-zinc-300 dark:border-stone-700 border-dashed py-16 px-4 text-center">
                    <h3 className="font-serif text-xl font-bold italic text-zinc-900 dark:text-stone-200 mb-2">
                        Ready to get things done.
                    </h3>
                    <p className="text-zinc-500 dark:text-stone-500 text-sm max-w-md mx-auto">
                        Add your first task below, then use <strong>Cubit</strong> to break it into steps
                        and <strong>Deep Dive</strong> to go deeper.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto pb-20">
            <div className="border border-zinc-300 dark:border-stone-700 rounded-xl overflow-hidden">
                <table className="w-full table-fixed border-collapse">
                    <thead>
                        <tr>
                            <th
                                className={`sticky left-0 text-left text-xs font-mono uppercase tracking-widest px-3 py-3 w-[20%] border-b border-zinc-300 dark:border-stone-600 rounded-tl-xl
                ${activeMode === 'cubit'
                                        ? 'z-30 relative bg-cyan-100 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400'
                                        : 'z-10 text-zinc-500 dark:text-stone-400 bg-zinc-100 dark:bg-stone-800'}
              `}
                            >
                                Task
                            </th>
                            {[1, 2, 3, 4].map((n) => (
                                <th
                                    key={n}
                                    className={`text-left text-xs font-mono uppercase tracking-widest px-3 py-3 w-[20%] border-b border-zinc-300 dark:border-stone-600
                      ${n === 4 ? 'rounded-tr-xl' : ''}
                  ${activeMode === 'deepDive' ? 'relative bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400' :
                                            activeMode === 'dialLeft' ? 'relative bg-green-500/10 text-green-700 dark:text-green-400' :
                                                activeMode === 'dialRight' ? 'relative bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' :
                                                    'text-zinc-500 dark:text-stone-400'
                                        }
                `}
                                >
                                    Step {n}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {todoRows.map((row) => {
                            const isProcessing = processingRowId === row.id;

                            return (
                                <tr
                                    key={row.id}
                                    id={row.id}
                                    onDoubleClick={() => handleDoubleClickEmptyRow(row)}
                                    onTouchStart={(e) => handleTouchStart(row.id, e.touches[0].clientX, e.touches[0].clientY)}
                                    onTouchEnd={(e) => handleTouchEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
                                    className={`group border-b border-zinc-200 dark:border-stone-800 transition-all relative
                   ${row.isCompleted ? 'bg-green-50/50 dark:bg-green-950/10' : ''}
                   ${isProcessing ? 'animate-pulse bg-zinc-50 dark:bg-stone-900/50' : ''}
                 `}
                                >
                                    {/* Task Column — Sticky */}
                                    <td
                                        className={`sticky left-0 px-3 py-3 align-top border-r border-zinc-200 dark:border-stone-700 w-[20%] overflow-hidden
                    ${isTaskActionTarget && mc
                                                ? `z-20 relative cursor-pointer ${mc.bg}`
                                                : 'z-10 bg-white dark:bg-[#1c1917]'}
                  `}
                                        // Click Interception Wrapper
                                        onClick={(e) => {
                                            if (window.getSelection()?.toString()) return; // Ignore selection

                                            if (activeMode === 'cubit') {
                                                if (!isProcessing && row.task.trim()) {
                                                    e.stopPropagation();
                                                    handleCubit(row.id, row.task);
                                                }
                                            } else if (activeMode !== null) {
                                                // Cancel Mode (Reset to Neutral)
                                                e.stopPropagation();
                                                setActiveMode(null);
                                            }
                                        }}
                                    >
                                        <div className="flex items-start gap-2">
                                            {/* Action Buttons — stacked vertically */}
                                            <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
                                                {/* Completion Toggle */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleTodoRowCompletion(row.id);
                                                    }}
                                                    className={`w-5 h-5 flex items-center justify-center rounded-full border-2 transition-all
                                                        ${row.isCompleted
                                                            ? 'bg-green-500 border-green-500 text-white'
                                                            : 'border-zinc-300 dark:border-stone-600 text-transparent hover:border-green-400 dark:hover:border-green-500'
                                                        }`}
                                                    title={row.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                                                    aria-label={row.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                                                >
                                                    {row.isCompleted ? <Check className="w-3 h-3" /> : null}
                                                </button>
                                                {/* Delete Toggle */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSwipeDelete(row.id);
                                                    }}
                                                    className="w-5 h-5 flex items-center justify-center rounded-full border-2 border-zinc-300 dark:border-stone-600 text-zinc-400 dark:text-stone-500 hover:border-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:border-red-500 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-all"
                                                    title="Delete row"
                                                    aria-label="Delete row"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div className={`flex-1 min-w-0 break-words ${row.isCompleted ? 'line-through opacity-60' : ''}`}>
                                                <EditableCell
                                                    value={row.task}
                                                    onSave={(val) => updateTodoCell(row.id, 'task', val)}
                                                    placeholder="Type a task…"
                                                    disabled={isModeActive || row.isCompleted}
                                                    autoFocus={!row.task.trim()}
                                                />
                                            </div>
                                        </div>
                                    </td>

                                    {/* Step Columns */}
                                    {row.steps.map((step, si) => (
                                        <td
                                            key={si}
                                            className={`px-3 py-3 align-top w-[20%]
                      ${isStepActionTarget && mc ? `cursor-pointer ${mc.bg}` : ''}
                    `}
                                            onClick={(e) => {
                                                if (window.getSelection()?.toString()) return; // Ignore selection

                                                if (isStepActionTarget) {
                                                    if (!isProcessing) {
                                                        e.stopPropagation();
                                                        handleStepClick(row, si);
                                                    }
                                                } else if (activeMode !== null) {
                                                    // Cancel Mode (Reset to Neutral)
                                                    e.stopPropagation();
                                                    setActiveMode(null);
                                                }
                                            }}
                                        >
                                            <div className={`${row.isCompleted ? 'opacity-40' : ''}`}>
                                                <EditableCell
                                                    value={step}
                                                    onSave={(val) => updateTodoCell(row.id, 'step', val, si)}
                                                    placeholder={`Step ${si + 1}`}
                                                    disabled={isModeActive} // Disable edit if ANY mode is active
                                                />
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
