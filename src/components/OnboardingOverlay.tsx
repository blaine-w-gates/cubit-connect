'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, ListTodo, Compass, X, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ONBOARDING_KEY = 'cubit_onboarding_complete';

const steps = [
  {
    icon: Video,
    title: 'The Engine',
    description: 'Upload a video or paste a transcript. AI distills it into actionable tasks with timestamps.',
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: Compass,
    title: 'Scout',
    description: 'Search social media for topics. AI generates search queries to find relevant content across platforms.',
    color: 'text-fuchsia-500',
    bg: 'bg-fuchsia-500/10',
  },
  {
    icon: ListTodo,
    title: 'To-Do',
    description: 'Manage your distilled tasks. Use Cubit to break tasks into steps, Deep Dive for sub-steps, and Priority Dials to focus.',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
];

export default function OnboardingOverlay() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const done = localStorage.getItem(ONBOARDING_KEY);
    const hasKey = localStorage.getItem('cubit_api_key');
    if (!done && hasKey) {
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShow(false);
  };

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  const goToPage = (path: string) => {
    dismiss();
    router.push(path);
  };

  const current = steps[step];
  const Icon = current.icon;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-zinc-200 dark:border-stone-700"
          >
            {/* Close */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-200 transition-colors"
              aria-label="Skip onboarding"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Progress dots */}
            <div className="flex gap-1.5 mb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-8 bg-zinc-900 dark:bg-stone-100' : 'w-1.5 bg-zinc-300 dark:bg-stone-600'
                  }`}
                />
              ))}
            </div>

            {/* Step content */}
            <div className={`w-14 h-14 rounded-xl ${current.bg} flex items-center justify-center mb-4`}>
              <Icon className={`w-7 h-7 ${current.color}`} />
            </div>

            <h2 className="text-xl font-bold font-serif italic mb-2 text-zinc-900 dark:text-stone-100">
              {current.title}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-stone-400 leading-relaxed mb-6">
              {current.description}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={dismiss}
                className="text-xs font-mono uppercase tracking-wide text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-300 transition-colors"
              >
                Skip Tour
              </button>
              <div className="flex items-center gap-2">
                {step === steps.length - 1 ? (
                  <button
                    onClick={() => goToPage('/todo')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-stone-200 transition-colors"
                  >
                    Go to To-Do
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={next}
                    className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-stone-200 transition-colors"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
