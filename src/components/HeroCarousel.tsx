'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDES = [
  {
    id: 1,
    title: 'Intentional Search Triggers',
    benefit: 'Retrains your algorithm to serve skills, not distractions.',
    advantage: 'You control the feed; the feed does not control you.',
  },
  {
    id: 2,
    title: 'High-Signal Filtering',
    benefit: 'Isolates the 1 post that teaches vs. the 10 that entertain.',
    advantage: 'Build a library of knowledge, not a graveyard of likes.',
  },
  {
    id: 3,
    title: 'AI Extraction Engine',
    benefit: 'Fills the instructional gaps that influencers leave out.',
    advantage: 'Unlock the full, paid-course value from a free 60-second clip.',
  },
  {
    id: 4,
    title: 'Output Authority Builder',
    benefit: 'Turns passive consumption into active contribution.',
    advantage: 'Stop being the audience. Start being the Expert.',
  },
];

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);

  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % SLIDES.length);
    }, 1500);
    return () => clearInterval(timer);
  }, [isPaused]);

  const currentSlide = SLIDES[index];

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-[#FAFAFA] overflow-hidden min-h-[650px] md:min-h-[500px]">
      {/* Start/Stop Control (A11y) */}
      <button
        onClick={() => setIsPaused(!isPaused)}
        className="absolute top-4 right-4 z-10 text-[10px] font-mono border border-black px-3 py-2 min-h-[44px] min-w-[44px] uppercase tracking-widest hover:bg-black hover:text-white active:bg-black active:text-white transition-colors flex items-center justify-center"
        aria-label={isPaused ? 'Resume Carousel' : 'Pause Carousel'}
      >
        {isPaused ? 'PLAY' : 'PAUSE'}
      </button>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentSlide.id}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute inset-0 flex items-center justify-center px-8 pb-20 pt-20"
        >
          <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Title Section represents the 'Header' of the column */}
            <div className="border border-black p-8 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-serif text-3xl md:text-4xl font-bold leading-tight uppercase tracking-tight">
                {currentSlide.title}
              </h3>
            </div>

            {/* Content Section represents the cells */}
            <div className="space-y-8 font-mono">
              <div className="border-l-4 border-black pl-6">
                <p className="text-xs uppercase tracking-widest text-zinc-600 mb-2">Benefit</p>
                <p className="text-lg leading-relaxed">{currentSlide.benefit}</p>
              </div>

              <div className="border-l-4 border-black pl-6 bg-zinc-100 py-4 pr-4">
                <p className="text-xs uppercase tracking-widest text-zinc-600 mb-2">Advantage</p>
                <p className="text-lg font-bold leading-relaxed">{currentSlide.advantage}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Pagination Indicators (tappable for touch devices) */}
      <div className="absolute bottom-10 flex gap-3">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setIndex(idx)}
            className={`w-3 h-3 rounded-full transition-colors min-w-[12px] min-h-[12px] p-1 ${idx === index ? 'bg-black' : 'bg-zinc-300'}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
