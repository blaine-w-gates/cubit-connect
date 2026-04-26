'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Check, GripVertical } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { useShallow } from 'zustand/react/shallow';
import { GeminiService } from '@/services/gemini';
import { TodoStep } from '@/services/storage';
import { AlarmContextButton } from '@/components/alarm/AlarmContextButton';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    useDraggable,
    useDroppable,
    DragOverlay,
    useDndContext,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Helper to parse Google API/Gemini errors safely
function parseGeminiError(err: Error): string {
    const msg = err.message || '';
    if (msg.includes('API_KEY_INVALID') || msg.includes('API key expired') || msg.includes('API key not valid')) {
        return "Your Gemini API key is invalid or expired. Please update it in Settings.";
    }
    try {
        if (msg.includes('{')) {
            const firstBrace = msg.indexOf('{');
            const jsonStr = msg.slice(firstBrace);
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].error?.message) {
                return parsed[0].error.message;
            }
            if (parsed.error && parsed.error.message) return parsed.error.message;
        }
    } catch {
        // INTENTIONALLY HANDLING: JSON parsing failures fall back to original error string
        // This is a best-effort parsing - if it fails, return the original message
    }
    return msg;
}

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
    onTabOutForward,
}: {
    value: string;
    onSave: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    className?: string;
    onTabOutForward?: () => void;
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

    // Auto-save draft after 800ms of typing pause (Seamless Collaborative Feel)
    useEffect(() => {
        if (!editing || draft === value) return;
        const timer = setTimeout(() => {
            onSave(draft);
        }, 800);
        return () => clearTimeout(timer);
    }, [draft, editing, onSave, value]);

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
                    if (e.key === 'Tab' && !e.shiftKey && onTabOutForward) {
                        e.preventDefault();
                        commit();
                        onTabOutForward();
                    }
                }}
                className={`w-full bg-transparent border-b border-zinc-400 dark:border-stone-500 outline-none text-sm px-1 py-0.5 resize-none max-h-[200px] overflow-y-auto ${className}`}
                placeholder={placeholder}
                rows={1}
            />
        );
    }

    return (
        <span
            tabIndex={disabled ? -1 : 0}
            onFocus={() => {
                if (!disabled) {
                    setDraft(value);
                    setEditing(true);
                }
            }}
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
            className={`block text-sm whitespace-pre-wrap break-words cursor-text focus:outline-none focus:bg-zinc-100 dark:focus:bg-stone-800 rounded px-1 min-h-[1.5rem] transition-colors ${!value ? 'text-zinc-400 dark:text-stone-600 italic' : ''} ${className}`}
        >
            {value || placeholder || '—'}
        </span>
    );
}

// --- Circular Progress Ring (Command Column) ---
function CircularProgress({ percentage, isCompleted }: { percentage: number; isCompleted: boolean }) {
    const radius = 12;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    if (isCompleted) {
        return (
            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md shadow-green-500/20 text-white transition-all">
                <Check className="w-4 h-4" strokeWidth={3} />
            </div>
        );
    }

    return (
        <div className="relative w-7 h-7 flex items-center justify-center group">
            {/* Background Track */}
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle
                    cx="14" cy="14" r={radius}
                    className="stroke-zinc-200 dark:stroke-stone-700 transition-colors"
                    strokeWidth="2.5" fill="none"
                />
                {/* Progress Fill */}
                <circle
                    cx="14" cy="14" r={radius}
                    className="stroke-cyan-500 dark:stroke-cyan-400 transition-all duration-500 ease-out"
                    strokeWidth="2.5" fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </svg>
            {/* Inner Percentage */}
            <span className="text-[9px] font-bold font-mono text-zinc-500 dark:text-stone-400">
                {Math.round(percentage)}
            </span>
        </div>
    );
}

// --- Particle Burst Animation ---
function ParticleBurst() {
    return (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-50">
            {Array.from({ length: 8 }).map((_, i) => {
                const angle = (i * 360) / 8;
                const rad = (angle * Math.PI) / 180;
                const tx = Math.cos(rad) * 40;
                const ty = Math.sin(rad) * 40;
                return (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50"
                        initial={{ scale: 1, x: 0, y: 0, opacity: 1 }}
                        animate={{
                            scale: 0,
                            x: tx,
                            y: ty,
                            opacity: 0,
                        }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                );
            })}
        </div>
    );
}

// --- Rabbit Draggable ---
function RabbitDraggable({ rowId, disabled, onClick, variant = 'command' }: { rowId: string, disabled: boolean, onClick?: () => void, variant?: 'command' | 'step' }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `rabbit-${rowId}`,
        data: { type: 'rabbit', rowId },
        disabled,
    });

    const isCommand = variant === 'command';

    return (
        <button
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={(e) => {
                if (onClick && !isDragging) {
                    e.stopPropagation();
                    onClick();
                }
            }}
            aria-label="Advance to next step"
            className={`flex items-center justify-center transition-all ${disabled ? 'hidden' : ''} ${isDragging ? 'opacity-0' : 'opacity-100'} cursor-grab active:cursor-grabbing z-30 hover:scale-[1.15] drop-shadow-sm ${isCommand ? 'w-7 h-7' : 'w-full h-full'}`}
            style={{ touchAction: 'none' }}
        >
            <span className={`transform -scale-x-100 relative ${isCommand ? 'text-lg' : 'text-6xl'}`}>🐇</span>
        </button>
    );
}

function RabbitOverlayWrapper() {
    const { active, activeNodeRect } = useDndContext();
    if (!active || active.data.current?.type !== 'rabbit') return null;

    return (
        <div
            className="flex items-center justify-center z-40 drop-shadow-2xl"
            style={{
                width: activeNodeRect?.width ? `${activeNodeRect.width}px` : 'auto',
                height: activeNodeRect?.height ? `${activeNodeRect.height}px` : 'auto',
            }}
        >
            <span className="text-lg transform -scale-x-100 relative">🐇</span>
        </div>
    );
}

export default function TodoTable() {
    const router = useRouter();
    const {
        todoRows,
        activeMode,
        processingRowId,
        lastAddedRowId,
        setActiveMode,
        setProcessingRowId,
        toggleTodoRowCompletion,
        deleteTodoRow,
        restoreTodoRow,
        updateTodoCell,
        moveTodoRowToBottom,
        reorderTodoRows,
        setTodoSteps,
        insertTodoRowAfter,
        setDialPriority,
        completeStepsUpTo,
        activeWorkspaceType,
        hasPeers,
        peerIsEditing,
        selectTaskForToday,
        showRowTomatoButtons,
        // Alarm system
        activeProjectId,
        todoProjects,
        selectedStepId,
        selectStep,
        clearSelectedStep,
    } = useAppStore(
        useShallow((s) => ({
            todoRows: s.todoRows,
            activeProjectId: s.activeProjectId,
            activeMode: s.activeMode,
            processingRowId: s.processingRowId,
            lastAddedRowId: s.lastAddedRowId,
            priorityDials: s.priorityDials,
            setActiveMode: s.setActiveMode,
            setProcessingRowId: s.setProcessingRowId,
            toggleTodoRowCompletion: s.toggleTodoRowCompletion,
            deleteTodoRow: s.deleteTodoRow,
            restoreTodoRow: s.restoreTodoRow,
            updateTodoCell: s.updateTodoCell,
            moveTodoRowToBottom: s.moveTodoRowToBottom,
            reorderTodoRows: s.reorderTodoRows,
            setTodoSteps: s.setTodoSteps,
            insertTodoRowAfter: s.insertTodoRowAfter,
            setDialPriority: s.setDialPriority,
            completeStepsUpTo: s.completeStepsUpTo,
            activeWorkspaceType: s.activeWorkspaceType,
            hasPeers: s.hasPeers,
            peerIsEditing: s.peerIsEditing,
            selectTaskForToday: s.selectTaskForToday,
            // P2 Fix: Select only the specific property to avoid unnecessary re-renders
            showRowTomatoButtons: s.todayPreferences.showRowTomatoButtons,
            // Alarm system
            todoProjects: s.todoProjects,
            selectedStepId: s.selectedStepId,
            selectStep: s.selectStep,
            clearSelectedStep: s.clearSelectedStep,
        })),
    );

    // Ref for click-outside handling
    const tableRef = useRef<HTMLDivElement>(null);
    
    // Clear selection when clicking outside the table
    useOnClickOutside(tableRef, () => {
        if (selectedStepId) {
            clearSelectedStep();
        }
    });

    // Get active project info for alarms
    const activeProject = todoProjects.find(p => p.id === activeProjectId);
    const projectName = activeProject?.name || 'Untitled Project';
    const projectAlarms = activeProject?.alarms || [];

    // Track active drag for the overlay portal
    const [activeRabbitId, setActiveRabbitId] = useState<string | null>(null);
    const [activeRowId, setActiveRowId] = useState<string | null>(null);
    const [explosionTargetId, setExplosionTargetId] = useState<string | null>(null);
    const archiveTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

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


    const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Swipe state (Fix #9: added startY for vertical guard)
    const swipeRef = useRef<{ startX: number; startY: number; rowId: string } | null>(null);

    const mc = activeMode ? MODE_COLORS[activeMode] : null;
    const isModeActive = activeMode !== null;
    const isTaskActionTarget = activeMode === 'cubit';
    const isStepActionTarget = ['deepDive', 'dialLeft', 'dialRight'].includes(activeMode || '');

    // Strict Mode: Shared Projects require both a connection and "Turn Reservation" to edit
    const isLocked = activeWorkspaceType === 'personalMulti' && (!hasPeers || peerIsEditing);

    const checkLock = useCallback((): boolean => {
        if (isLocked) {
            const reason = !hasPeers 
                ? 'To prevent sync mismatches, you must have at least 2 devices connected to edit a Shared Project.'
                : 'A peer is currently making changes. Please wait for them to finish.';
                
            toast.error('Shared Project Locked', {
                description: reason,
                icon: '🔒',
            });
            return true;
        }
        return false;
    }, [isLocked, hasPeers]);

    // --- Handlers ---

    const handleCubit = useCallback(async (rowId: string, taskText: string) => {
        if (checkLock()) return;
        if (!taskText.trim()) {
            toast.warning('Empty Task', { description: 'Type a task name before using Cubit.' });
            return;
        }
        setProcessingRowId(rowId);
        try {
            const rawSteps = await GeminiService.generateSubSteps(
                useAppStore.getState().apiKey,
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
        } catch (e) {
            // INTENTIONALLY HANDLING: AI generation failures show toast with actionable guidance
            // API key errors show settings button, other errors show generic message
            const err = e as Error;
            const parsedMsg = parseGeminiError(err);
            if (parsedMsg.includes('API key')) {
                toast.error('Cubit Failed', {
                    description: parsedMsg,
                    action: {
                        label: 'Update Key',
                        onClick: () => useAppStore.getState().setIsSettingsOpen(true)
                    }
                });
            } else {
                toast.error('Cubit Failed', { description: parsedMsg });
            }
        } finally {
            setActiveMode(null);
            setProcessingRowId(null);
        }
    }, [setTodoSteps, setActiveMode, setProcessingRowId, checkLock]);

    const handleDeepDive = useCallback(async (rowId: string, stepText: string, row: typeof todoRows[0]) => {
        if (checkLock()) return;
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
                .filter((s) => s.text.trim())
                .map((s, i) => `Step ${i + 1}: "${s.text}"`)
                .join('\n');

            const rawSteps = await GeminiService.generateSubSteps(
                useAppStore.getState().apiKey,
                `Deep Dive into: "${stepText}".\nSibling steps from parent row:\n${siblingContext}\nGenerate exactly 4 detailed sub-steps.`,
            );
            const steps: [string, string, string, string] = [
                rawSteps[0] || '',
                rawSteps[1] || '',
                rawSteps[2] || '',
                rawSteps[3] || '',
            ];
            setTodoSteps(newRowId, steps);
        } catch (e) {
            // INTENTIONALLY HANDLING: Deep Dive failures should show toast, not crash the UI
            const err = e as Error;
            const parsedMsg = parseGeminiError(err);
            if (parsedMsg.includes('API key')) {
                toast.error('Deep Dive Failed', {
                    description: parsedMsg,
                    action: {
                        label: 'Update Key',
                        onClick: () => useAppStore.getState().setIsSettingsOpen(true)
                    }
                });
            } else {
                toast.error('Deep Dive Failed', { description: parsedMsg });
            }
        } finally {
            setActiveMode(null);
            setProcessingRowId(null);
        }
    }, [insertTodoRowAfter, setTodoSteps, setActiveMode, setProcessingRowId, checkLock]);

    // Fix #1 & #2: Each branch resets independently. No trailing setActiveMode(null).
    // Read activeMode from getState() to avoid stale closure.
    const handleStepClick = useCallback((row: typeof todoRows[0], stepIdx: number) => {
        const stepText = row.steps[stepIdx].text;
        if (!stepText.trim()) return;

        const currentMode = useAppStore.getState().activeMode;

        if (currentMode === 'deepDive') {
            if (checkLock()) return;
            handleDeepDive(row.id, stepText, row);
            // handleDeepDive resets mode internally after async completion
        } else if (currentMode === 'dialLeft') {
            if (checkLock()) return;
            setDialPriority('left', stepText);
            setActiveMode(null); // Fire and Forget
        } else if (currentMode === 'dialRight') {
            if (checkLock()) return;
            setDialPriority('right', stepText);
            setActiveMode(null); // Fire and Forget
        }
    }, [handleDeepDive, setDialPriority, setActiveMode, checkLock]);

    // Fix #3: Uses store action `restoreTodoRow` instead of direct setState
    const handleSwipeDelete = useCallback((rowId: string) => {
        if (checkLock()) return;
        const idx = todoRows.findIndex((r) => r.id === rowId);
        const row = todoRows[idx];
        if (!row) return;

        deleteTodoRow(rowId);

        // Fix #13: Clear auto-archive timer to prevent memory leaks throwing unmounted component crashes
        if (archiveTimersRef.current[rowId]) {
            clearTimeout(archiveTimersRef.current[rowId]);
            delete archiveTimersRef.current[rowId];
        }

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
    }, [todoRows, deleteTodoRow, restoreTodoRow, checkLock]);

    const handleDoubleClickEmptyRow = useCallback((row: typeof todoRows[0]) => {
        const isEmpty = !row.task.trim() && row.steps.every((s) => !s.text.trim());
        if (isEmpty) moveTodoRowToBottom(row.id);
    }, [moveTodoRowToBottom]);

    // --- Touch swipe (Fix #9: vertical scroll guard) ---
    const handleTouchStart = (rowId: string, x: number, y: number) => {
        swipeRef.current = { startX: x, startY: y, rowId };
    };
    const handleTouchEnd = (e: React.TouchEvent, x: number, y: number) => {
        if (!swipeRef.current) return;
        
        // Fix #9 Part 2: Prevent text editing gestures (like cursor scrubbing) from triggering delete
        const targetTag = (e.target as HTMLElement).tagName?.toLowerCase();
        if (targetTag === 'textarea' || targetTag === 'input') {
            swipeRef.current = null;
            return;
        }

        const dx = x - swipeRef.current.startX;
        const dy = y - swipeRef.current.startY;
        
        // Strict Left-Swipe threshold to prevent accidental deletions
        if (dx < -150 && Math.abs(dy) < Math.abs(dx)) {
            handleSwipeDelete(swipeRef.current.rowId);
        }
        swipeRef.current = null;
    };

    // --- Drag-and-Drop ---
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
        useSensor(KeyboardSensor),
    );

    const handleDragStart = useCallback((event: { active: { id: string | number; data?: { current?: { type?: string } } } }) => {
        if (event.active.data?.current?.type === 'rabbit') {
            setActiveRabbitId(String(event.active.id));
        } else {
            setActiveRowId(String(event.active.id));
        }
    }, []);

    const handleDragCancel = useCallback(() => {
        setActiveRabbitId(null);
        setActiveRowId(null);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setActiveRabbitId(null);
        setActiveRowId(null);
        const { active, over } = event;
        if (!over) return;

        // Rabbit Drag Logic
        if (active.data.current?.type === 'rabbit') {
            const rowId = active.data.current.rowId;
            const dropData = over.data.current;

            // Note: If dropped in the void or on an invalid target, the rabbit simply snaps back
            if (dropData?.type === 'step') {
                const stepIdx = dropData.stepIdx;
                const row = todoRows.find(r => r.id === rowId);
                const prevIdx = row ? row.steps.findLastIndex(s => s.isCompleted && s.text.trim()) : -1;

                completeStepsUpTo(rowId, stepIdx);

                // Fix #10 & #18: Forward feedback (Explosion + A11y), Backward feedback (Toast)
                if (stepIdx < prevIdx) {
                    toast('Progress Reverted', { icon: '⏪' });
                } else if (stepIdx > prevIdx || prevIdx === -1) {
                    // Trigger explosion burst
                    setExplosionTargetId(`step-${rowId}-${stepIdx}`);
                    setTimeout(() => setExplosionTargetId(null), 800);
                    // Screen Reader fallback for successful progress
                    toast.success(`Completed Step ${stepIdx + 1}`, { className: 'sr-only' });
                }

                // Auto-archive if 100%
                if (row) {
                    const lastPopulatedIdx = row.steps.findLastIndex(s => s.text.trim());
                    if (lastPopulatedIdx !== -1 && stepIdx >= lastPopulatedIdx) {
                        archiveTimersRef.current[rowId] = setTimeout(() => {
                            useAppStore.getState().moveTodoRowToBottom(rowId);
                        }, 1500);
                    }
                }
            } else if (dropData?.type === 'reset') {
                if (checkLock()) return;
                completeStepsUpTo(rowId, -1);
                // Clear the auto-archive timer if dragging to reset zone
                if (archiveTimersRef.current[rowId]) {
                    clearTimeout(archiveTimersRef.current[rowId]);
                    delete archiveTimersRef.current[rowId];
                }
            }
            return;
        }

        // Row Reorder Logic
        if (active.id === over.id) return;
        if (checkLock()) return;
        const oldIndex = todoRows.findIndex((r) => r.id === active.id);
        const newIndex = todoRows.findIndex((r) => r.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
            reorderTodoRows(oldIndex, newIndex);
        }
    }, [todoRows, reorderTodoRows, completeStepsUpTo, checkLock]);

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
        <div className="overflow-x-auto pb-20" ref={tableRef}>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
                modifiers={activeRabbitId ? [restrictToHorizontalAxis, restrictToWindowEdges] : []}
            >
                <div className="border border-zinc-300 dark:border-stone-700 rounded-xl overflow-hidden">
                    <table className="w-full min-w-[900px] table-fixed border-collapse">
                        <thead>
                            <tr>
                                {/* Command Column Header */}
                                <th className="sticky left-0 w-[48px] min-w-[48px] z-30 border-b border-zinc-300 dark:border-stone-600 bg-zinc-100 dark:bg-stone-800 rounded-tl-xl"></th>

                                <th
                                    className={`text-left text-xs font-mono uppercase tracking-widest px-3 py-3 w-[30%] border-b border-zinc-300 dark:border-stone-600
                ${activeMode === 'cubit'
                                            ? 'z-10 relative bg-cyan-100 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400'
                                            : 'z-10 text-zinc-500 dark:text-stone-400 bg-zinc-100 dark:bg-stone-800'}
              `}
                                >
                                    Task
                                </th>
                                {[1, 2, 3, 4].map((n) => (
                                    <th
                                        key={n}
                                        className={`text-left text-xs font-mono uppercase tracking-widest px-3 py-3 w-[17.5%] border-b border-zinc-300 dark:border-stone-600
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
                        <SortableContext items={todoRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                            <tbody>
                                {todoRows.map((row, idx) => {
                                    const isProcessing = processingRowId === row.id;

                                    return (
                                        <SortableRow
                                            key={row.id}
                                            isLastRow={idx === todoRows.length - 1}
                                            onAddRow={() => useAppStore.getState().addTodoRow('')}
                                            row={row}
                                            isProcessing={isProcessing}
                                            isCompleted={row.isCompleted}
                                            isModeActive={isModeActive}
                                            isLocked={isLocked}
                                            isTaskActionTarget={isTaskActionTarget}
                                            isStepActionTarget={isStepActionTarget}
                                            mc={mc}
                                            onDoubleClick={() => handleDoubleClickEmptyRow(row)}
                                            onTouchStart={(e: React.TouchEvent) => handleTouchStart(row.id, e.touches[0].clientX, e.touches[0].clientY)}
                                            onTouchEnd={(e: React.TouchEvent) => handleTouchEnd(e, e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
                                            lastAddedRowId={lastAddedRowId}
                                            onTaskClick={(e: React.MouseEvent) => {
                                                if (window.getSelection()?.toString()) return;
                                                if (activeMode === 'cubit') {
                                                    if (!isProcessing && row.task.trim()) {
                                                        e.stopPropagation();
                                                        handleCubit(row.id, row.task);
                                                    }
                                                } else if (activeMode !== null) {
                                                    e.stopPropagation();
                                                    setActiveMode(null);
                                                }
                                            }}
                                            onToggleComplete={() => toggleTodoRowCompletion(row.id)}
                                            onDelete={() => handleSwipeDelete(row.id)}
                                            onTaskSave={(val) => updateTodoCell(row.id, 'task', val)}
                                            onStepSave={(val, si) => updateTodoCell(row.id, 'step', val, si)}
                                            onStepClick={(si) => {
                                                if (isStepActionTarget && !isProcessing) {
                                                    handleStepClick(row, si);
                                                } else if (activeMode !== null) {
                                                    setActiveMode(null);
                                                }
                                            }}
                                            onRabbitAdvance={(rowId, currentStepIdx) => {
                                                if (checkLock()) return;
                                                const nextIdx = row.steps.findIndex((s, i) => i > currentStepIdx && s.text.trim());
                                                let targetIdx = nextIdx;
                                                if (nextIdx !== -1) {
                                                    completeStepsUpTo(rowId, nextIdx);
                                                    setExplosionTargetId(`step-${rowId}-${nextIdx}`);
                                                    setTimeout(() => setExplosionTargetId(null), 800);
                                                } else {
                                                    targetIdx = -1; // Loop back to 0
                                                    completeStepsUpTo(rowId, -1);
                                                }
                                                // Check for 100%
                                                const populatedSteps = row.steps.filter(s => s.text.trim());
                                                const lastPopulatedIdx = row.steps.findLastIndex(s => s.text.trim());
                                                if (populatedSteps.length > 0 && targetIdx >= lastPopulatedIdx) {
                                                    archiveTimersRef.current[rowId] = setTimeout(() => {
                                                        useAppStore.getState().moveTodoRowToBottom(rowId);
                                                    }, 1500);
                                                }
                                            }}
                                            explosionTargetId={explosionTargetId}
                                            isRabbitDragging={activeRabbitId !== null}
                                            onGoToToday={() => {
                                                // Pre-select this task for Today - row tomato implies neutral focus
                                                selectTaskForToday(row.id, null);
                                                // Navigate to Today page
                                                router.push('/today');
                                            }}
                                            showRowTomatoButtons={showRowTomatoButtons}
                                            // Alarm props
                                            projectId={activeProjectId || ''}
                                            projectName={projectName}
                                            selectedStepId={selectedStepId}
                                            onSelectStep={selectStep}
                                            alarms={projectAlarms}
                                        />
                                    );
                                })}
                            </tbody>
                        </SortableContext>
                    </table>
                </div>

                {/* Portal for rendering Rabbit visibly above overflow-hidden bounds */}
                <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                    {(() => {
                        // Q7 Fix: Single computation of DragOverlay content
                        if (activeRabbitId) {
                            return <RabbitOverlayWrapper />;
                        }
                        if (activeRowId) {
                            const activeRow = todoRows.find((r) => r.id === activeRowId);
                            if (activeRow) {
                                return (
                                    <table className="w-full min-w-[900px] table-fixed border-collapse bg-white dark:bg-[#1c1917] shadow-xl rounded-xl">
                                        <tbody>
                                            <SortableRow
                                                row={activeRow}
                                                isProcessing={processingRowId === activeRowId}
                                                isCompleted={activeRow.isCompleted}
                                                isModeActive={isModeActive}
                                                isLocked={isLocked}
                                                isTaskActionTarget={isTaskActionTarget}
                                                isStepActionTarget={isStepActionTarget}
                                                mc={mc}
                                                onDoubleClick={() => { }}
                                                onTouchStart={() => { }}
                                                onTouchEnd={() => { }}
                                                lastAddedRowId={lastAddedRowId}
                                                onTaskClick={() => { }}
                                                onToggleComplete={() => { }}
                                                onDelete={() => { }}
                                                onTaskSave={() => { }}
                                                onStepSave={() => { }}
                                                onStepClick={() => { }}
                                                onRabbitAdvance={() => { }}
                                                explosionTargetId={null}
                                                isRabbitDragging={false}
                                                onGoToToday={() => { }}
                                                isLastRow={false}
                                                onAddRow={() => { }}
                                                showRowTomatoButtons={false}
                                                // Alarm props (drag overlay doesn't need interactivity)
                                                projectId={activeProjectId || ''}
                                                projectName={projectName}
                                                selectedStepId={null}
                                                onSelectStep={() => { }}
                                                alarms={[]}
                                            />
                                        </tbody>
                                    </table>
                                );
                            }
                        }
                        return null;
                    })()}
                </DragOverlay>
            </DndContext>
        </div>
    );
}

// --- Sortable Row Component ---
interface SortableRowProps {
    row: { id: string; task: string; steps: [TodoStep, TodoStep, TodoStep, TodoStep]; isCompleted: boolean };
    isProcessing: boolean;
    isCompleted: boolean;
    isModeActive: boolean;
    isLocked: boolean;
    isTaskActionTarget: boolean;
    isStepActionTarget: boolean;
    mc: { bg: string } | null;
    onDoubleClick: () => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTaskClick: (e: React.MouseEvent) => void;
    onToggleComplete: () => void;
    onDelete: () => void;
    onTaskSave: (val: string) => void;
    onStepSave: (val: string, si: number) => void;
    onStepClick: (si: number) => void;
    onRabbitAdvance: (rowId: string, currentStepIdx: number) => void;
    explosionTargetId: string | null;
    isRabbitDragging: boolean;
    lastAddedRowId: string | null;
    onGoToToday: () => void;
    isLastRow: boolean;
    onAddRow: () => void;
    showRowTomatoButtons: boolean;
    // Alarm system props
    projectId: string;
    projectName: string;
    selectedStepId: { projectId: string; rowId: string; stepIndex: number } | null;
    onSelectStep: (projectId: string, rowId: string, stepIndex: number) => void;
    alarms: { id: string; sourceStepId?: string; status: string; alarmTimeMs: number }[];
}

// --- Droppable Step Cell Component ---
function StepCellNode({
    row, step, si, isCompleted, isModeActive, isLocked, isStepActionTarget, mc, onStepSave, onStepClick, currentStepIdx, onRabbitAdvance, explosionTargetId, isRabbitDragging, isLastRow, onAddRow,
    // Alarm props
    projectId, projectName, isSelected, onSelectStep, stepAlarm
}: {
    row: SortableRowProps['row'], step: TodoStep, si: number, isCompleted: boolean, isModeActive: boolean, isLocked: boolean, isStepActionTarget: boolean, mc: { bg: string } | null, onStepSave: (val: string, si: number) => void, onStepClick: (si: number) => void, currentStepIdx: number, onRabbitAdvance: () => void, explosionTargetId: string | null, isRabbitDragging: boolean, isLastRow: boolean, onAddRow: () => void,
    // Alarm props
    projectId: string, projectName: string, isSelected: boolean, onSelectStep: () => void, stepAlarm?: { id: string; alarmTimeMs: number; status: string }
}) {
    const isPopulated = step.text.trim().length > 0;

    const id = `step-${row.id}-${si}`;
    const { setNodeRef, isOver } = useDroppable({
        id,
        data: { type: 'step', rowId: row.id, stepIdx: si },
        disabled: isModeActive || isLocked || !isPopulated, // Missing steps reject drops
    });

    return (
        <td
            ref={setNodeRef}
            className={`px-3 py-3 align-top w-[17.5%] relative transition-colors ${isLocked && !isPopulated ? 'opacity-50 cursor-not-allowed' : ''}
                ${isStepActionTarget && mc ? `cursor-pointer ${mc.bg}` : ''}
                ${isRabbitDragging && isPopulated && !isOver ? 'shadow-[inset_0_0_0_2px_rgba(99,102,241,0.2)]' : ''}
                ${isOver ? 'bg-indigo-50 dark:bg-indigo-950/30 shadow-[inset_0_0_0_2px_rgba(99,102,241,0.5)]' : ''}
                ${isSelected ? 'ring-2 ring-cyan-400 dark:ring-cyan-500 ring-inset' : ''}
            `}
            onClick={(e) => {
                if (window.getSelection()?.toString()) return;
                e.stopPropagation();
                onSelectStep();
                onStepClick(si);
            }}
        >
            {/* Alarm Context Button - appears when step is selected */}
            {isSelected && isPopulated && !isModeActive && !isLocked && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-30">
                    <AlarmContextButton
                        projectId={projectId}
                        rowId={row.id}
                        stepIndex={si}
                        stepText={step.text}
                        taskText={row.task}
                        projectName={projectName}
                        stepId={step.id || `${row.id}-step-${si}`}
                        isSelected={isSelected}
                    />
                </div>
            )}

            <div className={`transition-opacity duration-200 ${currentStepIdx === si ? 'opacity-0' : 'opacity-100'} ${isCompleted ? 'opacity-40 line-through' : ''}`}>
                <EditableCell
                    value={step.text}
                    onSave={(val) => onStepSave(val, si)}
                    placeholder={`Step ${si + 1}`}
                    disabled={isModeActive || isLocked}
                    className={`text-zinc-700 dark:text-stone-300 ${isLocked ? 'cursor-not-allowed' : ''}`}
                    onTabOutForward={si === 3 && isLastRow ? onAddRow : undefined}
                />
                {/* Alarm indicator - shows clock icon for steps with alarms */}
                {stepAlarm && stepAlarm.status !== 'dismissed' && (
                    <span className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 ml-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {new Date(stepAlarm.alarmTimeMs).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                )}
            </div>
            {/* Conditional Rabbit placement inside the Step Cell */}
            {currentStepIdx === si && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <RabbitDraggable rowId={row.id} disabled={isModeActive || isLocked} onClick={onRabbitAdvance} variant="step" />
                </div>
            )}

            {/* Particle Burst Explosion */}
            {explosionTargetId === id && <ParticleBurst />}
        </td>
    );
}

function SortableRow({
    row, projectId, projectName, isProcessing, isCompleted, isModeActive,
    isLocked, isTaskActionTarget, isStepActionTarget, mc,
    onDoubleClick, onTouchStart, onTouchEnd, onTaskClick,
    onToggleComplete, onDelete, onTaskSave, onStepSave, onStepClick, onRabbitAdvance, explosionTargetId, isRabbitDragging, lastAddedRowId, onGoToToday, isLastRow, onAddRow, showRowTomatoButtons,
    selectedStepId, onSelectStep, alarms
}: SortableRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: row.id, disabled: isLocked });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : undefined,
    };

    // --- Calculate Completion Percentage ---
    // Fix #2: Strict mathematical progression based on 4 columns.
    // If currentStepIdx = -1, progress is 0. If 0, 25%. If 1, 50%. If 2, 75%. If 3, 100%.
    const currentStepIdx = row.steps.findLastIndex(s => s.isCompleted && s.text.trim());
    const progress = (currentStepIdx + 1) * 25;

    // The entire row gets a subtle green tint if 100%. Active Modes override it.
    const isRow100Percent = progress === 100;
    const bgClass = isProcessing ? 'animate-pulse bg-zinc-50 dark:bg-stone-900/50'
        : isModeActive ? '' // Strict Mode Hierarchy overrides green
            : isRow100Percent ? 'bg-green-50/50 dark:bg-green-950/10' : '';

    const { setNodeRef: setResetNodeRef } = useDroppable({
        id: `reset-zone-${row.id}`,
        data: { type: 'reset', rowId: row.id }
    });

    return (
        <tr
            ref={setNodeRef}
            style={style}
            id={row.id}
            onDoubleClick={onDoubleClick}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className={`group border-b border-zinc-200 dark:border-stone-800 transition-all relative ${bgClass}`}
        >
            {/* Command Column — 1/6 (Sticky Left) */}
            <td
                ref={setResetNodeRef}
                className={`sticky left-0 w-[44px] min-w-[44px] z-20 border-r border-zinc-200 dark:border-stone-700 p-1
                ${isRow100Percent && !isModeActive ? 'bg-green-50/80 dark:bg-[#162A1D]' : 'bg-white dark:bg-[#1c1917]'}`}
                aria-label="Reset task progress"
            >
                <div className="flex flex-col items-center justify-center gap-2 h-full">
                    {/* Ring and Rabbit Container */}
                    <div className="relative w-[32px] h-[32px] flex items-center justify-center">
                        <button onClick={onToggleComplete} className="absolute inset-0 focus:outline-none rounded-full ring-2 ring-transparent focus-visible:ring-cyan-500 transition-all flex items-center justify-center" aria-label="Toggle Complete">
                            <CircularProgress percentage={progress} isCompleted={isCompleted || isRow100Percent} />
                        </button>

                        {/* Render rabbit securely centered over the SVG ring if 0% progress */}
                        {currentStepIdx === -1 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                <div className={`pointer-events-auto mt-[1px] ${isLocked ? 'opacity-50' : ''}`}>
                                    <RabbitDraggable rowId={row.id} disabled={isModeActive || isLocked} onClick={() => onRabbitAdvance(row.id, currentStepIdx)} variant="command" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sub-actions container (appears on hover, drag, or touch devices) */}
                    <div className={`flex flex-col gap-1 sm:opacity-0 sm:group-hover:opacity-100 hover-reveal transition-opacity ${isDragging ? 'opacity-100' : ''} ${isLocked ? 'hidden' : ''}`}>
                        <button
                            {...attributes}
                            {...listeners}
                            className="w-7 h-7 flex items-center justify-center rounded text-zinc-300 dark:text-stone-600 hover:text-zinc-500 dark:hover:text-stone-400 cursor-grab active:cursor-grabbing transition-colors"
                            title="Drag to reorder"
                            aria-label="Drag to reorder"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <GripVertical className="w-5 h-5" />
                        </button>
                        {showRowTomatoButtons && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onGoToToday();
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded text-zinc-300 dark:text-stone-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-950/20 transition-all"
                                title="Go to Today 🍅"
                                aria-label="Go to Today page to focus on this task"
                            >
                                <span className="text-sm">🍅</span>
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded text-zinc-300 dark:text-stone-600 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-all"
                            title="Delete task"
                            aria-label="Delete task"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </td>

            {/* Task Column — 2/6 (Not sticky anymore to allow scrolling room) */}
            <td
                className={`px-3 py-3 align-top border-r border-zinc-200 dark:border-stone-700 w-[32%]
                    ${isTaskActionTarget && mc ? `cursor-pointer ${mc.bg}` : ''}
                `}
                onClick={onTaskClick}
            >
                <div className={`pr-4 flex-1 min-w-0 break-words ${isCompleted || isRow100Percent ? 'line-through opacity-60' : ''}`}>
                    <EditableCell
                        value={row.task}
                        onSave={onTaskSave}
                        placeholder="Type a task…"
                        disabled={isModeActive || isLocked}
                        autoFocus={row.id === lastAddedRowId}
                        className={`text-zinc-700 dark:text-stone-300 ${isLocked ? 'cursor-not-allowed' : ''}`}
                    />
                </div>
            </td>

            {/* Step Columns — 3-6/6 */}
            {row.steps.map((step, si) => {
                const stepId = step.id || `${row.id}-step-${si}`;
                const isSelected = selectedStepId?.projectId === projectId && selectedStepId?.rowId === row.id && selectedStepId?.stepIndex === si;
                const stepAlarm = alarms.find(a => a.sourceStepId === stepId && a.status !== 'dismissed');
                return (
                    <StepCellNode
                        key={si}
                        row={row}
                        step={step}
                        si={si}
                        isCompleted={isCompleted || isRow100Percent}
                        isModeActive={isModeActive}
                        isLocked={isLocked}
                        isStepActionTarget={isStepActionTarget}
                        mc={mc}
                        onStepSave={onStepSave}
                        onStepClick={onStepClick}
                        currentStepIdx={currentStepIdx}
                        onRabbitAdvance={() => onRabbitAdvance(row.id, currentStepIdx)}
                        explosionTargetId={explosionTargetId}
                        isRabbitDragging={isRabbitDragging}
                        isLastRow={isLastRow}
                        onAddRow={onAddRow}
                        // Alarm props
                        projectId={projectId}
                        projectName={projectName}
                        isSelected={isSelected}
                        onSelectStep={() => onSelectStep(projectId, row.id, si)}
                        stepAlarm={stepAlarm}
                    />
                );
            })}
        </tr>
    );
}
