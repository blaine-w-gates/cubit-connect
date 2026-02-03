import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';

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
  className = '',
  multiline = false,
  placeholder = 'Empty',
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Focus management
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setTempValue(value);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (tempValue?.trim() !== value) {
      onSave(tempValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!multiline) {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSave();
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setTempValue(value);
      setIsEditing(false);
    }
    e.stopPropagation();
  };

  // 1. EDIT MODE (Textarea/Input)
  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`bg-zinc-50 dark:bg-stone-800 border border-purple-500 dark:border-purple-600 rounded px-2 py-1 outline-none resize-none w-full text-zinc-900 dark:text-stone-200 ${className}`}
          style={{ minHeight: '60px' }}
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
        className={`bg-zinc-50 dark:bg-stone-800 border border-purple-500 dark:border-purple-600 rounded px-2 outline-none w-full text-zinc-900 dark:text-stone-200 ${className}`}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  // 2. VIEW MODE (Markdown)
  // Uses "prose" for styling but forces compact margins for High Density
  return (
    <div
      onClick={handleStartEdit}
      className={`
                cursor-text hover:bg-zinc-100 dark:hover:bg-stone-800 rounded px-2 py-0.5 -mx-2 transition-colors border border-transparent 
                min-h-[24px] 
                prose prose-sm prose-zinc dark:prose-invert max-w-none
                prose-p:my-0 prose-ul:my-0 prose-li:my-0 prose-headings:my-1
                leading-normal
                ${className} 
                ${!value?.trim() ? 'italic text-zinc-400 dark:text-stone-500' : 'text-zinc-900 dark:text-stone-300'}
            `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleStartEdit(e);
      }}
    >
      {value ? (
        <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkBreaks]}>
          {value}
        </ReactMarkdown>
      ) : (
        placeholder
      )}
    </div>
  );
}
