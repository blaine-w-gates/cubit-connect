import { Printer, FileText } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { generateMarkdown } from '@/utils/exportUtils';

interface ExportControlProps {
  onPrint?: () => void;
  variant?: 'row' | 'col';
}

export default function ExportControl({ onPrint, variant = 'row' }: ExportControlProps) {
  const { projectTitle, tasks } = useAppStore();

  const checkEmpty = () => {
    if (!tasks || tasks.length === 0) {
      toast.warning('Project Empty', {
        description: 'Start by uploading content.',
      });
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

    // Use unified utility logic for consistent markdown generation
    const fullText = generateMarkdown(tasks, projectTitle || 'Project Export');

    try {
      await navigator.clipboard.writeText(fullText);
      toast.success('Markdown Copied', {
        description: 'Report text has been copied to your clipboard.',
      });
      useAppStore.getState().addLog('Markdown Copied to Clipboard');
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
        <button onClick={triggerPrint} className={btnClass} title="Export PDF">
          <Printer className="w-4 h-4" />
          <span className={variant === 'row' ? 'hidden sm:inline' : ''}>PDF</span>
        </button>

        <button onClick={handleCopyMarkdown} className={btnClass} title="Copy Markdown">
          <FileText className="w-4 h-4" />
          <span className={variant === 'row' ? 'hidden sm:inline' : ''}>Copy MD</span>
        </button>
      </div>
    </>
  );
}
