'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';

export default function NotFound() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  // Initialize with a deterministic value to satisfy SSR hydration matches
  const [randomDelay, setRandomDelay] = useState(5);

  useEffect(() => {
    // Update with random value only on client-side mount
    // Wrapping in requestAnimationFrame to ensure it runs after render commit
    // avoiding the immediate sync setState warning
    const id = requestAnimationFrame(() => {
        setRandomDelay(5 + Math.random() * 5);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Validate Email (Simple Regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setStatus('loading');

    // Simulate network delay (800ms)
    setTimeout(() => {
      setStatus('success');
      toast.success('Signal Received. Welcome to the Inner Circle.');
      console.log(`[WAITLIST]: ${email}`);
    }, 800);
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeInOut" },
    },
  };

  const glitchVariants: Variants = {
    initial: { x: 0, textShadow: '0px 0px 0px rgba(0,0,0,0)' },
    animate: {
      x: [0, -2, 2, -1, 1, 0],
      textShadow: [
        '0px 0px 0px rgba(0,0,0,0)',
        '2px 0px 0px #ef4444, -2px 0px 0px #06b6d4', // Red-500, Cyan
        '-2px 0px 0px #ef4444, 2px 0px 0px #06b6d4',
        '1px 0px 0px #ef4444, -1px 0px 0px #06b6d4',
        '-1px 0px 0px #ef4444, 1px 0px 0px #06b6d4',
        '0px 0px 0px rgba(0,0,0,0)',
      ],
      transition: {
        repeat: Infinity,
        repeatType: 'mirror',
        duration: 4,
        repeatDelay: randomDelay,
        times: [0, 0.05, 0.1, 0.15, 0.2, 1],
      },
    },
  };

  return (
    <div className="min-h-screen w-full relative overflow-y-auto overflow-x-hidden bg-gradient-to-br from-zinc-50 to-white dark:from-stone-900 dark:to-black text-foreground selection:bg-indigo-100 dark:selection:bg-indigo-900/30">
      {/* Decor (The Fractal) - Fixed Position */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {/* Concentric Circles */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-zinc-900/5 dark:border-white/5"
            style={{
              width: `${i * 40}vh`,
              height: `${i * 40}vh`,
            }}
            animate={{
              rotate: i % 2 === 0 ? 360 : -360,
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 60 + i * 20,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
        {/* Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      </div>

      {/* Content Wrapper - Centering with Scroll Support */}
      <div className="min-h-screen w-full flex flex-col items-center justify-center py-12">
        <motion.div
          className="z-10 w-full max-w-2xl px-6 md:px-8 flex flex-col items-start md:items-center text-left md:text-center space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Headline */}
          <motion.div variants={itemVariants} className="relative">
            <motion.h1
              className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
              variants={glitchVariants}
              initial="initial"
              animate="animate"
            >
              404: Coordinate Not Found.
            </motion.h1>
          </motion.div>

          {/* Sub-head */}
          <motion.p variants={itemVariants} className="text-lg md:text-xl text-zinc-500 font-medium">
            You are lost. Or are you early?
          </motion.p>

          {/* The Pitch */}
          <motion.div variants={itemVariants} className="max-w-md space-y-4">
            <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              You found the backdoor to Cubit To-Do. It applies the Engine&apos;s logic to your life. Take
              any task. Click Cubit to break it into 4 steps. Click &apos;Deep Dive&apos; to break those into 4
              baby steps. Infinite granularity for getting things done.
            </p>
          </motion.div>

          {/* Interactive Components */}
          <motion.form
            variants={itemVariants}
            onSubmit={handleSubmit}
            className="w-full max-w-sm flex flex-col space-y-6 mt-4"
          >
            <div className="relative group">
              <input
                type="email"
                placeholder="Signal Interest"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'success'}
                className="w-full bg-transparent border-b border-zinc-200 dark:border-zinc-800 py-2 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:border-indigo-500 transition-colors duration-300"
              />
            </div>

            <button
              type="submit"
              disabled={status !== 'idle' || !email}
              className="group relative flex items-center justify-center space-x-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed h-10"
            >
              <AnimatePresence mode="wait">
                {status === 'idle' && (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    Signal Interest
                  </motion.span>
                )}
                {status === 'loading' && (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    Transmitting...
                  </motion.span>
                )}
                {status === 'success' && (
                  <motion.span
                    key="success"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2 text-green-600 dark:text-green-500"
                  >
                    <Check className="w-4 h-4" />
                    Signal Received
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </motion.form>

          {/* Return Link */}
          <motion.div variants={itemVariants} className="pt-8">
            <Link
              href="/"
              className="text-xs text-zinc-400 hover:text-indigo-600 transition-colors duration-300"
            >
              Return to Engine
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
