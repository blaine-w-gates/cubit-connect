'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * EditableCell — Inline editable text cell with auto-save.
 *
 * Extracted from TodoTable.tsx as part of component decomposition (#26).
 * Pure presentational component — no store dependencies.
 */
export function EditableCell({
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
