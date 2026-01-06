import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface EditableTextProps {
    value: string;
    onSave: (newValue: string) => void;
    className?: string;
    multiline?: boolean;
    placeholder?: string;
}

export function EditableText({
    value,
    onSave,
    className = "",
    multiline = false,
    placeholder = "Empty"
}: EditableTextProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    // Focus when entering edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            // Optional: Select all text? Or Cursor at end? Let's do cursor at end.
            const len = inputRef.current.value.length;
            inputRef.current.setSelectionRange(len, len);
        }
    }, [isEditing]);

    const handleStartEdit = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent accordion toggling
        setTempValue(value);
        setIsEditing(true);
    };

    const handleSave = () => {
        if (tempValue.trim() !== value) {
            onSave(tempValue); // Only save if changed
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (!multiline) {
                e.preventDefault();
                handleSave();
            } else if (e.ctrlKey || e.metaKey) {
                // Ctrl+Enter to save in Textarea
                e.preventDefault();
                handleSave();
            }
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setTempValue(value); // Revert
            setIsEditing(false);
        }
        e.stopPropagation(); // Prevent parent listeners
    };

    if (isEditing) {
        if (multiline) {
            return (
                <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className={`bg-zinc-950/50 border border-blue-500/50 rounded px-1 outline-none resize-none overflow-hidden w-full ${className}`}
                    style={{ minHeight: '60px' }} // Heuristic for description
                    onClick={(e) => e.stopPropagation()}
                />
            );
        }
        return (
            <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`bg-zinc-950/50 border border-blue-500/50 rounded px-1 outline-none w-full ${className}`}
                onClick={(e) => e.stopPropagation()}
            />
        );
    }

    return (
        <span
            onClick={handleStartEdit}
            className={`cursor-text hover:bg-white/5 rounded px-1 -mx-1 transition-colors border border-transparent hover:border-zinc-800 ${className} ${!value.trim() ? 'italic text-zinc-600' : ''}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleStartEdit(e as any);
            }}
        >
            {value || placeholder}
        </span>
    );
}
