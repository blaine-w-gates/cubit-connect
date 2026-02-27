'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { ChevronRight, ChevronLeft, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TodoProject } from '@/schemas/storage';

// Must match TAB_COLORS in useAppStore.ts
const PALETTE = [
    '#F87171', '#FB923C', '#FBBF24', '#A3E635', '#34D399',
    '#22D3EE', '#818CF8', '#C084FC', '#F472B6', '#94A3B8',
];

// ─── Inline Accordion Color Picker ────────────────────────────────────────────
// Renders as a 2×5 grid of 28px swatches that expands between tabs.
// Mobile-first: 28px swatches > 44px touch target with gap/padding,
// single-tap to open, single-tap to pick.
function ColorAccordion({
    currentColor,
    onPick,
}: {
    currentColor: string;
    onPick: (color: string) => void;
}) {
    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
        >
            <div
                className="grid grid-cols-5 gap-2 px-3 py-3
                    bg-zinc-100/80 dark:bg-stone-800/60
                    border border-zinc-200 dark:border-stone-700
                    rounded-lg mx-1 my-1"
            >
                {PALETTE.map((swatch) => (
                    <button
                        key={swatch}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onPick(swatch);
                        }}
                        className={`w-7 h-7 rounded-full mx-auto
                            transition-all duration-150
                            hover:scale-110 active:scale-95
                            ${swatch === currentColor
                                ? 'ring-2 ring-offset-2 ring-zinc-500 dark:ring-stone-300 dark:ring-offset-stone-900 scale-110'
                                : 'hover:ring-1 hover:ring-zinc-300 dark:hover:ring-stone-500'
                            }
                        `}
                        style={{ backgroundColor: swatch }}
                        aria-label={`Set color to ${swatch}`}
                    />
                ))}
            </div>
        </motion.div>
    );
}

// ─── Sortable Tab Item ─────────────────────────────────────────────────────────
function SortableProjectTab({
    project,
    isActive,
    isEditing,
    editingDraft,
    isColorOpen,
    onDraftChange,
    onCommitRename,
    onCancelRename,
    onStartEditing,
    onProjectClick,
    onProjectDelete,
    onColorDotTap,
    onColorPick,
    canDelete,
}: {
    project: TodoProject;
    isActive: boolean;
    isEditing: boolean;
    editingDraft: string;
    isColorOpen: boolean;
    onDraftChange: (val: string) => void;
    onCommitRename: () => void;
    onCancelRename: () => void;
    onStartEditing: (id: string, name: string) => void;
    onProjectClick: (id: string) => void;
    onProjectDelete: (id: string) => void;
    onColorDotTap: (id: string) => void;
    onColorPick: (id: string, color: string) => void;
    canDelete: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: project.id,
        disabled: isEditing || isColorOpen, // Don't drag while editing or picking color
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        borderLeftColor: isActive ? project.color : 'transparent',
    };

    return (
        <div>
            {/* Tab row */}
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                onClick={() => { if (!isEditing && !isColorOpen) onProjectClick(project.id); }}
                onDoubleClick={() => { if (!isEditing) onStartEditing(project.id, project.name); }}
                className={`group relative flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer
                    transition-all text-sm select-none
                    ${isActive
                        ? 'bg-white dark:bg-stone-800 shadow-sm border-l-4'
                        : 'hover:bg-zinc-100 dark:hover:bg-stone-800/50 border-l-4 border-transparent'
                    }
                `}
            >
                {/* Color dot — single tap opens accordion */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation(); // Don't switch project
                        onColorDotTap(project.id);
                    }}
                    className={`w-4 h-4 rounded-full flex-shrink-0 transition-all duration-150
                        hover:scale-125 active:scale-95
                        ${isColorOpen ? 'ring-2 ring-offset-1 ring-zinc-400 dark:ring-stone-400 scale-110' : ''}
                    `}
                    style={{ backgroundColor: project.color }}
                    title="Tap to change color"
                    aria-label="Change project color"
                />

                {/* Tab name or rename input */}
                {isEditing ? (
                    <input
                        autoFocus
                        value={editingDraft}
                        onChange={(e) => onDraftChange(e.target.value)}
                        onBlur={onCommitRename}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onCommitRename();
                            if (e.key === 'Escape') onCancelRename();
                        }}
                        className="flex-1 min-w-0 bg-transparent border-b border-zinc-400 dark:border-stone-500 outline-none text-sm px-0.5"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className={`flex-1 min-w-0 break-words ${isActive
                        ? 'font-semibold text-zinc-900 dark:text-stone-100'
                        : 'text-zinc-600 dark:text-stone-400'}`}
                    >
                        {project.name}
                    </span>
                )}

                {/* Delete */}
                {canDelete && !isEditing && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onProjectDelete(project.id); }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 dark:text-stone-500 dark:hover:text-red-400 transition-all flex-shrink-0"
                        title="Delete project"
                        aria-label={`Delete project ${project.name}`}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Color accordion — expands below this tab, pushing siblings down */}
            <AnimatePresence>
                {isColorOpen && (
                    <ColorAccordion
                        currentColor={project.color}
                        onPick={(color) => onColorPick(project.id, color)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Drag Overlay ──────────────────────────────────────────────────────────────
function ProjectTabOverlay({ project, isActive }: { project: TodoProject; isActive: boolean }) {
    return (
        <div
            className="flex items-center gap-2 px-2 py-2 rounded-md cursor-grabbing
                shadow-xl ring-1 ring-black/5 dark:ring-white/10
                text-sm select-none bg-white dark:bg-stone-800 border-l-4"
            style={{ borderLeftColor: isActive ? project.color : 'transparent' }}
        >
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
            <span className={`flex-1 min-w-0 break-words ${isActive
                ? 'font-semibold text-zinc-900 dark:text-stone-100'
                : 'text-zinc-600 dark:text-stone-400'}`}
            >
                {project.name}
            </span>
        </div>
    );
}

// ─── Main Sidebar ──────────────────────────────────────────────────────────────
export default function BookTabSidebar() {
    const {
        todoProjects,
        activeProjectId,
        addTodoProject,
        setActiveProject,
        renameTodoProject,
        deleteTodoProject,
        reorderTodoProjects,
        changeProjectColor,
    } = useAppStore(
        useShallow((s) => ({
            todoProjects: s.todoProjects,
            activeProjectId: s.activeProjectId,
            addTodoProject: s.addTodoProject,
            setActiveProject: s.setActiveProject,
            renameTodoProject: s.renameTodoProject,
            deleteTodoProject: s.deleteTodoProject,
            reorderTodoProjects: s.reorderTodoProjects,
            changeProjectColor: s.changeProjectColor,
        })),
    );

    const [isOpen, setIsOpen] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [colorPickerId, setColorPickerId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor),
    );

    const commitRename = () => {
        if (editingId && draft.trim()) renameTodoProject(editingId, draft.trim());
        setEditingId(null);
    };

    const handleColorDotTap = (projectId: string) => {
        // Toggle: if already open for this project, close it; otherwise open
        setColorPickerId((prev) => (prev === projectId ? null : projectId));
    };

    const handleColorPick = (projectId: string, color: string) => {
        changeProjectColor(projectId, color);
        setColorPickerId(null); // Close accordion after picking
    };

    const handleDragStart = (e: DragStartEvent) => {
        setActiveDragId(e.active.id as string);
        setColorPickerId(null); // Close any open color picker when dragging
    };
    const handleDragEnd = (e: DragEndEvent) => {
        setActiveDragId(null);
        const { active, over } = e;
        if (over && active.id !== over.id) {
            const from = todoProjects.findIndex((p) => p.id === active.id);
            const to = todoProjects.findIndex((p) => p.id === over.id);
            reorderTodoProjects(from, to);
        }
    };

    const activeDragProject = todoProjects.find((p) => p.id === activeDragId);

    return (
        <div className="relative flex-shrink-0 z-20">
            {/* Collapsed strip */}
            <AnimatePresence mode="wait">
                {!isOpen && (
                    <motion.button
                        key="toggle-open"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setIsOpen(true)}
                        className="sticky top-24 h-10 w-8 flex items-center justify-center
                            bg-zinc-100 dark:bg-stone-800 border border-zinc-300 dark:border-stone-600
                            rounded-r-md hover:bg-zinc-200 dark:hover:bg-stone-700 transition-colors"
                        title="Open project tabs"
                        aria-label="Open project tabs"
                    >
                        <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-stone-400" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Expanded sidebar */}
            <AnimatePresence mode="wait">
                {isOpen && (
                    <motion.aside
                        key="sidebar"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 192, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden border-r border-zinc-200 dark:border-stone-700 bg-zinc-50 dark:bg-stone-900 flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-200 dark:border-stone-700">
                            <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 dark:text-stone-400">
                                Projects
                            </span>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-zinc-400 dark:text-stone-500 hover:text-zinc-600 dark:hover:text-stone-300 transition-colors"
                                title="Collapse sidebar"
                                aria-label="Collapse sidebar"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        </div>

                        {/* + Project */}
                        <button
                            onClick={() => addTodoProject()}
                            className="mx-3 mt-3 mb-1 flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold font-mono uppercase tracking-wide
                                bg-zinc-900 dark:bg-stone-200 text-white dark:text-stone-900
                                rounded hover:bg-zinc-800 dark:hover:bg-stone-300 transition-all active:scale-95"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Project
                        </button>

                        {/* Tab list */}
                        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDragCancel={() => setActiveDragId(null)}
                            >
                                <SortableContext
                                    items={todoProjects.map((p) => p.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {todoProjects.map((project) => (
                                        <SortableProjectTab
                                            key={project.id}
                                            project={project}
                                            isActive={project.id === activeProjectId}
                                            isEditing={editingId === project.id}
                                            editingDraft={draft}
                                            isColorOpen={colorPickerId === project.id}
                                            onDraftChange={setDraft}
                                            onCommitRename={commitRename}
                                            onCancelRename={() => setEditingId(null)}
                                            onStartEditing={(id, name) => { setEditingId(id); setDraft(name); }}
                                            onProjectClick={setActiveProject}
                                            onProjectDelete={deleteTodoProject}
                                            onColorDotTap={handleColorDotTap}
                                            onColorPick={handleColorPick}
                                            canDelete={todoProjects.length > 1}
                                        />
                                    ))}
                                </SortableContext>

                                <DragOverlay
                                    dropAnimation={{
                                        sideEffects: defaultDropAnimationSideEffects({
                                            styles: { active: { opacity: '0.4' } },
                                        }),
                                    }}
                                >
                                    {activeDragProject ? (
                                        <ProjectTabOverlay
                                            project={activeDragProject}
                                            isActive={activeDragProject.id === activeProjectId}
                                        />
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                        </div>

                        {/* Footer */}
                        <div className="px-3 py-2 border-t border-zinc-200 dark:border-stone-700">
                            <span className="text-[10px] font-mono text-zinc-400 dark:text-stone-500">
                                {todoProjects.length} {todoProjects.length === 1 ? 'project' : 'projects'}
                            </span>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>
        </div>
    );
}
