import { Compass, Layers, Share2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';

export function Manifesto() {
  const { setInputMode } = useAppStore();

  const scrollToIgnition = () => {
    document.getElementById('ignition')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4 animate-in fade-in duration-700 relative">
      <h2 className="text-3xl md:text-4xl font-serif font-bold italic text-zinc-900 dark:text-stone-200 mb-4 tracking-tight">
        Learn, Create, Engage!
      </h2>
      <p className="text-zinc-800 dark:text-zinc-300 max-w-lg mb-12 text-base md:text-lg leading-relaxed">
        You can copy posts, expand them into step-by-step plans. Use your recipes to engage with
        others, and make them your own posts.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-3xl w-full">
        {/* SCOUT CARD */}
        <button
          onClick={() => {
            setInputMode('scout');
            scrollToIgnition();
          }}
          className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-transparent hover:border-cyan-500/50 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all hover:scale-105 active:scale-95 text-left md:text-center w-full"
        >
          <div className="p-3 bg-zinc-100 dark:bg-stone-800 text-zinc-600 dark:text-stone-400 rounded-full group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors self-center">
            <Compass className="w-6 h-6" />
          </div>
          <div className="space-y-1 w-full">
            <h3 className="font-bold text-zinc-900 dark:text-stone-200 text-center">Scout</h3>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 text-center">
              Find high-signal topics.
            </p>
          </div>
        </button>

        {/* STRUCTURE CARD */}
        <button
          onClick={() => {
            setInputMode('video');
            scrollToIgnition();
          }}
          className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-transparent hover:border-fuchsia-500/50 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/20 hover:shadow-[0_0_15px_rgba(217,70,239,0.15)] transition-all hover:scale-105 active:scale-95 text-left md:text-center w-full"
        >
          <div className="p-3 bg-zinc-100 dark:bg-stone-800 text-zinc-600 dark:text-stone-400 rounded-full group-hover:bg-fuchsia-100 dark:group-hover:bg-fuchsia-900 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400 transition-colors self-center">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1 w-full">
            <h3 className="font-bold text-zinc-900 dark:text-stone-200 text-center">Structure</h3>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 text-center">
              Break complexity into steps.
            </p>
          </div>
        </button>

        {/* EXPORT CARD */}
        <button
          onClick={() =>
            toast.warning('Start a Project First', {
              description: 'Upload a video or paste text to unlock this tool.',
            })
          }
          className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-transparent hover:border-green-500/50 hover:bg-green-50 dark:hover:bg-green-950/20 hover:shadow-[0_0_15px_rgba(34,197,94,0.15)] transition-all hover:scale-105 active:scale-95 text-left md:text-center w-full"
        >
          <div className="p-3 bg-zinc-100 dark:bg-stone-800 text-zinc-600 dark:text-stone-400 rounded-full group-hover:bg-green-100 dark:group-hover:bg-green-900 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors self-center">
            <Share2 className="w-6 h-6" />
          </div>
          <div className="space-y-1 w-full">
            <h3 className="font-bold text-zinc-900 dark:text-stone-200 text-center">Export</h3>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 text-center">
              PDF & Markdown ready.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
