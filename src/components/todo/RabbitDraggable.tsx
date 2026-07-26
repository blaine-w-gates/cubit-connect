'use client';

import { useDraggable, useDndContext } from '@dnd-kit/core';

/**
 * RabbitDraggable — Draggable rabbit handle for advancing steps.
 *
 * Extracted from TodoTable.tsx as part of component decomposition (#26).
 */
export function RabbitDraggable({ rowId, disabled, onClick, variant = 'command' }: { rowId: string, disabled: boolean, onClick?: () => void, variant?: 'command' | 'step' }) {
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

/**
 * RabbitOverlayWrapper — Drag overlay for the rabbit handle.
 *
 * Extracted from TodoTable.tsx as part of component decomposition (#26).
 */
export function RabbitOverlayWrapper() {
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
