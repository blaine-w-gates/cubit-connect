'use client';

import { X, GripVertical } from 'lucide-react';
import {
    useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { EditableCell } from './EditableCell';
import { CircularProgress } from './CircularProgress';
import { RabbitDraggable } from './RabbitDraggable';
import { StepCellNode } from './StepCellNode';
import type { SortableRowProps } from './types';

/**
 * SortableRow — A single draggable/sortable todo row with command column,
 * task column, and 4 step columns.
 *
 * Extracted from TodoTable.tsx as part of component decomposition (#26).
 */
export function SortableRow({
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
