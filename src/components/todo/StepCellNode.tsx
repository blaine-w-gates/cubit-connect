'use client';

import { useDroppable } from '@dnd-kit/core';
import { AlarmContextButton } from '@/components/alarm/AlarmContextButton';
import { EditableCell } from './EditableCell';
import { RabbitDraggable } from './RabbitDraggable';
import { ParticleBurst } from './ParticleBurst';
import type { StepCellNodeProps } from './types';

/**
 * StepCellNode — Droppable step cell with inline editing, alarm context,
 * and rabbit drag handle.
 *
 * Extracted from TodoTable.tsx as part of component decomposition (#26).
 */
export function StepCellNode({
    row, step, si, isCompleted, isModeActive, isLocked, isStepActionTarget, mc, onStepSave, onStepClick, currentStepIdx, onRabbitAdvance, explosionTargetId, isRabbitDragging, isLastRow, onAddRow,
    // Alarm props
    projectId, projectName, isSelected, onSelectStep, stepAlarm
}: StepCellNodeProps) {
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
