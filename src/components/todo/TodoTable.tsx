'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Wand2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { GeminiService } from '@/services/gemini';
import { toast } from 'sonner';

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
    const inputRef = useRef<HTMLTextAreaElement>(null);

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
                ref={inputRef as any}
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
                className={`w-full bg-transparent border-b border-zinc-400 dark:border-stone-500 outline-none text-sm px-1 py-0.5 resize-none overflow-hidden ${className}`}
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
        updateTodoCell,
        deleteTodoRow,
        toggleTodoRowCompletion,
        setTodoSteps,
        insertTodoRowAfter,
        setDialPriority,
        moveTodoRowToBottom,
        setActiveMode,
    } = useAppStore(
        useShallow((s) => ({
            todoRows: s.todoRows,
            activeMode: s.activeMode,
            updateTodoCell: s.updateTodoCell,
            deleteTodoRow: s.deleteTodoRow,
            toggleTodoRowCompletion: s.toggleTodoRowCompletion,
            setTodoSteps: s.setTodoSteps,
            insertTodoRowAfter: s.insertTodoRowAfter,
            setDialPriority: s.setDialPriority,
            moveTodoRowToBottom: s.moveTodoRowToBottom,
            setActiveMode: s.setActiveMode,
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
    const [processingRowId, setProcessingRowId] = useState<string | null>(null);
    const [undoRow, setUndoRow] = useState<{ row: typeof todoRows[0]; index: number } | null>(null);
    const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Swipe state
    const swipeRef = useRef<{ startX: number; rowId: string } | null>(null);

    // Mode color configs
    const modeColors: Record<string, { border: string; bg: string; ring: string; dimmed: string }> = {
        cubit: {
            border: 'border-cyan-400 dark:border-cyan-500',
            bg: 'bg-cyan-100 dark:bg-cyan-950/30',
            ring: 'ring-cyan-400 dark:ring-cyan-500',
            dimmed: 'opacity-40 pointer-events-none',
        },
        deepDive: {
            border: 'border-fuchsia-400 dark:border-fuchsia-500',
            bg: 'bg-fuchsia-500/10 dark:bg-fuchsia-950/20',
            ring: 'ring-fuchsia-400 dark:ring-fuchsia-500',
            dimmed: 'opacity-40 pointer-events-none',
        },
        dialLeft: {
            border: 'border-green-400 dark:border-green-500',
            bg: 'bg-green-500/10 dark:bg-green-950/20',
            ring: 'ring-green-400 dark:ring-green-500',
            dimmed: 'opacity-40 pointer-events-none',
        },
        dialRight: {
            border: 'border-yellow-400 dark:border-yellow-500',
            bg: 'bg-yellow-500/10 dark:bg-yellow-950/20',
            ring: 'ring-yellow-400 dark:ring-yellow-500',
            dimmed: 'opacity-40 pointer-events-none',
        },
    };

    const mc = activeMode ? modeColors[activeMode] : null;
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
    }, [apiKey, setTodoSteps, setActiveMode]);

    const handleDeepDive = useCallback(async (rowId: string, stepText: string, row: typeof todoRows[0]) => {
        if (!apiKey) return;
        if (!stepText.trim()) return;

        // Create new row below with step as task
        const newRowId = insertTodoRowAfter(rowId, stepText);

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
    }, [apiKey, insertTodoRowAfter, setTodoSteps, setActiveMode]);

    const handleStepClick = useCallback((row: typeof todoRows[0], stepIdx: number) => {
        const stepText = row.steps[stepIdx];
        if (!stepText.trim()) return;

        if (activeMode === 'deepDive') {
            handleDeepDive(row.id, stepText, row);
        } else if (activeMode === 'dialLeft') {
            setDialPriority('left', stepText);
        } else if (activeMode === 'dialRight') {
            setDialPriority('right', stepText);
        }

        // Fire and Forget: Reset mode after action
        setActiveMode(null);
    }, [activeMode, handleDeepDive, setDialPriority, setActiveMode]);

    const handleSwipeDelete = useCallback((rowId: string) => {
        const idx = todoRows.findIndex((r) => r.id === rowId);
        const row = todoRows[idx];
        if (!row) return;

        // Store for undo
        setUndoRow({ row, index: idx });
        deleteTodoRow(rowId);

        // Clear previous timer
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

        toast('Task deleted', {
            action: {
                label: 'Undo',
                onClick: () => {
                    // Re-insert at original position
                    useAppStore.getState().reorderTodoRows(0, 0); // trigger re-render
                    // Actually insert back
                    const currentRows = useAppStore.getState().todoRows;
                    const restored = [...currentRows];
                    restored.splice(idx, 0, row);
                    useAppStore.setState({ todoRows: restored });
                    setUndoRow(null);
                },
            },
            duration: 5000,
        });

        undoTimerRef.current = setTimeout(() => setUndoRow(null), 5000);
    }, [todoRows, deleteTodoRow]);

    const handleDoubleClickEmptyRow = useCallback((row: typeof todoRows[0]) => {
        const isEmpty = !row.task.trim() && row.steps.every((s) => !s.trim());
        if (isEmpty) moveTodoRowToBottom(row.id);
    }, [moveTodoRowToBottom]);

    // --- Touch swipe ---
    const handleTouchStart = (rowId: string, x: number) => {
        swipeRef.current = { startX: x, rowId };
    };
    const handleTouchEnd = (x: number) => {
        if (!swipeRef.current) return;
        const dx = x - swipeRef.current.startX;
        if (Math.abs(dx) > 100) {
            handleSwipeDelete(swipeRef.current.rowId);
        }
        swipeRef.current = null;
    };

    if (todoRows.length === 0) {
        return (
            <div className="text-center py-16 border border-dashed border-zinc-300 dark:border-stone-700 rounded-xl">
                <p className="text-zinc-500 dark:text-stone-500 font-serif text-lg italic">
                    Nothing to do yet.
                </p>
                <p className="text-zinc-400 dark:text-stone-600 text-sm mt-2">
                    Click <strong>+ Task</strong> below to begin.
                </p>
            </div>
        );
    }



    return (
        <div className="overflow-x-auto pb-20">
            <table className="w-full table-fixed border-collapse">
                <thead>
                    <tr>
                        <th
                            className={`sticky left-0 text-left text-xs font-mono uppercase tracking-widest px-3 py-3 w-[20%]
                ${activeMode === 'cubit'
                                    ? 'z-30 relative ring-2 ring-inset ring-cyan-400 bg-cyan-100 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400'
                                    : 'z-10 border-b border-zinc-300 dark:border-stone-600 text-zinc-500 dark:text-stone-400 bg-zinc-100 dark:bg-stone-800'}
              `}
                        >
                            Task
                        </th>
                        {[1, 2, 3, 4].map((n) => (
                            <th
                                key={n}
                                className={`text-left text-xs font-mono uppercase tracking-widest px-3 py-3 w-[20%]
                  ${activeMode === 'deepDive' ? 'z-20 relative ring-2 ring-inset ring-fuchsia-400 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400' :
                                        activeMode === 'dialLeft' ? 'z-20 relative ring-2 ring-inset ring-green-400 bg-green-500/10 text-green-700 dark:text-green-400' :
                                            activeMode === 'dialRight' ? 'z-20 relative ring-2 ring-inset ring-yellow-400 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' :
                                                'border-b border-zinc-300 dark:border-stone-600 text-zinc-500 dark:text-stone-400'
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
                                onDoubleClick={() => handleDoubleClickEmptyRow(row)}
                                onTouchStart={(e) => handleTouchStart(row.id, e.touches[0].clientX)}
                                onTouchEnd={(e) => handleTouchEnd(e.changedTouches[0].clientX)}
                                className={`group border-b border-zinc-200 dark:border-stone-800 transition-all relative
                  ${row.isCompleted ? 'opacity-50 line-through' : ''}
                  ${isProcessing ? 'animate-pulse bg-zinc-50 dark:bg-stone-900/50' : ''}
                `}
                            >
                                {/* Delete button — visible on row hover */}


                                {/* Task Column — Sticky */}
                                <td
                                    className={`sticky left-0 px-3 py-3 align-top border-r border-zinc-200 dark:border-stone-700 w-[20%]
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
                                    <EditableCell
                                        value={row.task}
                                        onSave={(val) => updateTodoCell(row.id, 'task', val)}
                                        placeholder="Type a task…"
                                        disabled={isModeActive} // Disable edit if ANY mode is active
                                        autoFocus={!row.task.trim()}
                                        className="pr-6" // Reserve space for delete button
                                    />
                                    {/* Delete button — visible on row hover */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent row click
                                            handleSwipeDelete(row.id);
                                        }}
                                        className="absolute right-0 top-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 w-5 h-5 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 z-20"
                                        title="Delete row"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
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
                                        <EditableCell
                                            value={step}
                                            onSave={(val) => updateTodoCell(row.id, 'step', val, si)}
                                            placeholder={`Step ${si + 1}`}
                                            disabled={isModeActive} // Disable edit if ANY mode is active
                                        />
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
