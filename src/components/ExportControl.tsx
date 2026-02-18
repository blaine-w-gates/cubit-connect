import { Printer, FileText } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { generateMarkdown, generateTodoMarkdown } from '@/utils/exportUtils';
import { usePathname } from 'next/navigation';

interface ExportControlProps {
  onPrint?: () => void;
  variant?: 'row' | 'col';
}

export default function ExportControl({ onPrint, variant = 'row' }: ExportControlProps) {
  const { projectTitle, tasks, todoRows, priorityDials } = useAppStore();
  const pathname = usePathname();
  const isTodoPage = pathname === '/todo';

  const checkEmpty = () => {
    if (isTodoPage) {
      if (!todoRows || todoRows.length === 0) {
        toast.warning('No Tasks Yet', { description: 'Add tasks to your board first.' });
        return true;
      }
      return false;
    }
    if (!tasks || tasks.length === 0) {
      toast.warning('Project Empty', { description: 'Start by uploading content.' });
      return true;
    }
    return false;
  };

  const triggerPrint = () => {
    if (checkEmpty()) return;
    if (onPrint) onPrint();
  };

  const handleCopyMarkdown = async () => {
    if (checkEmpty()) return;

    const fullText = isTodoPage
      ? generateTodoMarkdown(todoRows, priorityDials, projectTitle || 'Task Board')
      : generateMarkdown(tasks, projectTitle || 'Project Export');

    try {
      await navigator.clipboard.writeText(fullText);
      toast.success(isTodoPage ? 'Task Board Copied' : 'Markdown Copied', {
        description: `${isTodoPage ? 'Task board' : 'Report'} text has been copied to your clipboard.`,
      });
      useAppStore.getState().addLog(`${isTodoPage ? 'Todo' : 'Engine'} Markdown Copied to Clipboard`);
    } catch {
      toast.error('Copy Failed', { description: 'Could not access clipboard.' });
    }
  };

  const btnClass =
    variant === 'row'
      ? 'flex items-center gap-2 text-xs text-zinc-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 transition-colors'
      : 'w-full justify-start rounded-lg hover:bg-zinc-100 dark:hover:bg-stone-800 mb-2 text-xs px-3 py-3 min-h-[44px] transition-colors font-bold flex items-center gap-2 active:scale-95 text-zinc-600 dark:text-stone-400';

  return (
    <>
      {/* CONTROLS */}
      <div className={variant === 'row' ? 'flex items-center gap-4' : 'flex flex-col gap-1'}>
        {/* PDF — only on Engine (no PrintableReport for Todo yet) */}
        {!isTodoPage && (
          <button onClick={triggerPrint} className={btnClass} title="Export PDF">
            <Printer className="w-4 h-4" />
            <span className={variant === 'row' ? 'hidden sm:inline' : ''}>PDF</span>
          </button>
        )}

        <button onClick={handleCopyMarkdown} className={btnClass} title={isTodoPage ? 'Copy Task Board' : 'Copy Markdown'}>
          <FileText className="w-4 h-4" />
          <span className={variant === 'row' ? 'hidden sm:inline' : ''}>{isTodoPage ? 'Copy Board' : 'Copy MD'}</span>
        </button>
      </div>
    </>
  );
}
