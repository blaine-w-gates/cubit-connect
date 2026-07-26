'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { useShallow } from 'zustand/react/shallow';
import { GeminiService } from '@/services/gemini';
import { toast } from 'sonner';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    DragOverlay,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { RabbitOverlayWrapper } from './RabbitDraggable';
import { SortableRow } from './SortableRow';
import { parseGeminiError } from './parseGeminiError';

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
                    <table className="w-full min-w-[600px] sm:min-w-[900px] table-fixed border-collapse">
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
