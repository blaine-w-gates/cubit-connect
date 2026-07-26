import { TodoStep } from '@/services/storage';

/**
 * Shared types for TodoTable sub-components.
 *
 * Extracted from TodoTable.tsx as part of component decomposition (#26).
 */

export interface SortableRowProps {
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

export interface StepCellNodeProps {
    row: SortableRowProps['row'];
    step: TodoStep;
    si: number;
    isCompleted: boolean;
    isModeActive: boolean;
    isLocked: boolean;
    isStepActionTarget: boolean;
    mc: { bg: string } | null;
    onStepSave: (val: string, si: number) => void;
    onStepClick: (si: number) => void;
    currentStepIdx: number;
    onRabbitAdvance: () => void;
    explosionTargetId: string | null;
    isRabbitDragging: boolean;
    isLastRow: boolean;
    onAddRow: () => void;
    // Alarm props
    projectId: string;
    projectName: string;
    isSelected: boolean;
    onSelectStep: () => void;
    stepAlarm?: { id: string; alarmTimeMs: number; status: string };
}
