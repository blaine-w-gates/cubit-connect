'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface FadeInProps {
  children: ReactNode;
  when?: boolean;
  duration?: number;
  className?: string;
}

export const FadeIn = ({ children, when = true, duration = 0.4, className = '' }: FadeInProps) => {
  return (
    <AnimatePresence mode="wait">
      {when && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration, ease: 'easeOut' }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
