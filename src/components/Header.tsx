import { useState, useRef, useEffect } from 'react';
import { Key, Menu, X, Compass, ListTodo } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import ExportControl from '@/components/ExportControl';
import { useAppStore } from '@/store/useAppStore';
import ThemeSelector from './ThemeSelector';
import { usePathname, useRouter } from 'next/navigation';

interface HeaderProps {
  onPrint?: () => void;
  confirmingReset: boolean;
  setConfirmingReset: (v: boolean) => void;
  resetProject: () => void;
  mounted: boolean;
  tasksLength: number;
}

export default function Header({
  onPrint,
  confirmingReset,
  setConfirmingReset,
  resetProject,
  mounted,
  tasksLength,
}: HeaderProps) {
  const isOnline = useNetworkStatus();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { setInputMode, setIsSettingsOpen } = useAppStore();
  const pathname = usePathname();
  const router = useRouter();
  const isEnginePage = pathname === '/engine';
  const isTodoPage = pathname === '/todo';
  const badgeText = isTodoPage ? 'Todo' : 'Engine';

  // Close mobile menu when clicking outside
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 h-[60px] border-b border-zinc-200 dark:border-stone-800 bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm relative">
      <div className="h-full px-4 md:px-6 flex items-center justify-between">
        {/* LOGO */}
        <div className="font-bold text-base md:text-lg tracking-tight flex items-center gap-2 font-serif text-zinc-900 dark:text-white shrink-0">
          Cubit Connect
          <span className="text-xs bg-zinc-900 dark:bg-stone-200 text-white dark:text-stone-900 px-2 py-0.5 rounded-none font-mono hidden min-[360px]:inline-block">
            {badgeText}
          </span>
          {!isOnline && (
            <span className="text-xs bg-red-100 text-red-700 border border-red-500 px-2 py-0.5 flex items-center gap-1 hidden sm:flex">
              Offline
            </span>
          )}
        </div>

        {/* DESKTOP */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* SCOUT BUTTON (Ghost Style) - Only on Engine page */}
            {isEnginePage && (
              <button
                onClick={() => {
                  setInputMode('scout');
                  document.getElementById('ignition')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-2 text-xs text-zinc-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 transition-colors"
              >
                <Compass className="w-4 h-4" />
                <span>Scout</span>
              </button>
            )}

            {isEnginePage && <div className="h-4 w-[1px] bg-zinc-200 dark:bg-stone-600 mx-1" />}

            {/* TO DO BUTTON */}
            <button
              onClick={() => router.push('/todo')}
              className={`flex items-center gap-2 text-xs transition-colors ${isTodoPage
                ? 'text-black dark:text-white font-bold'
                : 'text-zinc-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-100'
                }`}
            >
              <ListTodo className="w-4 h-4" />
              <span>To Do</span>
            </button>

            {/* ENGINE BUTTON - Only when NOT on engine page */}
            {!isEnginePage && (
              <>
                <div className="h-4 w-[1px] bg-zinc-200 dark:bg-stone-600 mx-1" />
                <button
                  onClick={() => router.push('/engine')}
                  className="flex items-center gap-2 text-xs text-zinc-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 transition-colors"
                >
                  <Compass className="w-4 h-4" />
                  <span>Engine</span>
                </button>
              </>
            )}

            <div className="h-4 w-[1px] bg-zinc-200 dark:bg-stone-600 mx-1" />

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 text-xs text-zinc-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 transition-colors"
            >
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">API Key</span>
            </button>
            <div className="h-4 w-[1px] bg-zinc-200 dark:bg-stone-600 mx-1" />
          </div>

          <ExportControl onPrint={onPrint} variant="row" />

          {mounted && tasksLength > 0 && <div className="h-4 w-[1px] bg-zinc-200 dark:bg-stone-600 mx-1" />}

          {mounted && tasksLength > 0 && (
            <button
              onClick={() => {
                if (confirmingReset) resetProject();
                else setConfirmingReset(true);
              }}
              className={`text-xs px-3 py-1.5 transition-colors font-bold flex items-center gap-2 ${confirmingReset ? 'text-red-600 underline' : 'text-zinc-400 hover:text-red-500'}`}
            >
              {confirmingReset ? 'Sure?' : 'Reset'}
            </button>
          )}

          {/* Theme Toggle (Right Aligned) */}
          <div className="h-4 w-[1px] bg-zinc-200 dark:bg-stone-600 mx-1" />
          <ThemeSelector />
        </div>

        {/* MOBILE - CLEANED UP FOR "MOBILE SMASH" */}
        <div className="flex md:hidden items-center gap-1">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-black dark:text-stone-200 active:scale-95 transition-transform ml-1"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* MOBILE DROPDOWN */}
      {isMobileMenuOpen && (
        <div
          ref={menuRef}
          className="absolute top-[60px] right-0 w-64 bg-white dark:bg-stone-900 border-l border-b border-zinc-200 dark:border-stone-800 shadow-xl p-4 flex flex-col gap-4 md:hidden animate-in slide-in-from-top-2 duration-200"
        >
          <div className="space-y-4">
            <div className="pb-4 border-b border-zinc-100 dark:border-stone-800">
              <div className="text-xs font-mono text-zinc-400 dark:text-stone-500 uppercase mb-2">
                Tools
              </div>
              {isEnginePage && (
                <button
                  onClick={() => {
                    setInputMode('scout');
                    document.getElementById('ignition')?.scrollIntoView({ behavior: 'smooth' });
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full justify-start rounded-lg hover:bg-zinc-100 dark:hover:bg-stone-800 mb-2 text-xs px-3 py-3 min-h-[44px] transition-colors font-bold flex items-center gap-2 active:scale-95 text-zinc-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-100"
                >
                  <Compass className="w-4 h-4" />
                  Scout
                </button>
              )}
              <button
                onClick={() => {
                  router.push('/todo');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full justify-start rounded-lg hover:bg-zinc-100 dark:hover:bg-stone-800 mb-2 text-xs px-3 py-3 min-h-[44px] transition-colors font-bold flex items-center gap-2 active:scale-95 ${isTodoPage
                  ? 'text-black dark:text-white'
                  : 'text-zinc-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-100'
                  }`}
              >
                <ListTodo className="w-4 h-4" />
                To Do
              </button>
              {!isEnginePage && (
                <button
                  onClick={() => {
                    router.push('/engine');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full justify-start rounded-lg hover:bg-zinc-100 dark:hover:bg-stone-800 mb-2 text-xs px-3 py-3 min-h-[44px] transition-colors font-bold flex items-center gap-2 active:scale-95 text-zinc-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-100"
                >
                  <Compass className="w-4 h-4" />
                  Engine
                </button>
              )}
              <button
                onClick={() => {
                  setIsSettingsOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full justify-start rounded-lg hover:bg-zinc-100 dark:hover:bg-stone-800 mb-2 text-xs px-3 py-3 min-h-[44px] transition-colors font-bold flex items-center gap-2 active:scale-95 text-zinc-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-100"
              >
                <Key className="w-4 h-4" />
                API Key
              </button>
            </div>
            <div className="pb-4 border-b border-zinc-100 dark:border-stone-800">
              <div className="text-xs font-mono text-zinc-400 dark:text-stone-500 uppercase mb-2">
                Export
              </div>
              <ExportControl onPrint={onPrint} variant="col" />
            </div>
            <div>
              <div className="text-xs font-mono text-zinc-400 dark:text-stone-500 uppercase mb-2">
                Session
              </div>
              {mounted && tasksLength > 0 && (
                <button
                  onClick={() => {
                    if (confirmingReset) resetProject();
                    else setConfirmingReset(true);
                  }}
                  className={`w-full justify-start rounded-lg hover:bg-zinc-100 dark:hover:bg-stone-800 mb-2 text-xs px-3 py-3 min-h-[44px] transition-colors font-bold flex items-center gap-2 active:scale-95 ${confirmingReset ? 'text-red-600 underline' : 'text-zinc-400 dark:text-stone-400 hover:text-red-500'}`}
                >
                  {confirmingReset ? 'Sure?' : 'Reset Project'}
                </button>
              )}
            </div>

            {/* Mobile Theme Toggle */}
            <div className="pt-4 border-t border-zinc-100 dark:border-stone-800">
              <div className="text-xs font-mono text-zinc-400 dark:text-stone-500 uppercase mb-2">
                Theme
              </div>
              <ThemeSelector mobile />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
