'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion, Variants } from 'framer-motion';
import { toast } from 'sonner';
import { Check, ArrowRight, Loader2 } from 'lucide-react';

export default function NotFound() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const shouldReduceMotion = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Strict Email Regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      toast.error('Invalid Coordinate format.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('https://formspree.io/f/xqedkapg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setIsSuccess(true);
        toast.success('Signal Received.');
      } else {
        const data = await response.json().catch(() => ({}));
        if (data.errors && Array.isArray(data.errors)) {
             const messages = data.errors.map((err: { message: string }) => err.message).join(', ');
             toast.error(messages || 'Signal Jammed.');
        } else {
             toast.error('Signal Jammed.');
        }
      }
    } catch {
      toast.error('Signal Jammed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Animation Variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };

  const glitchAnimation = shouldReduceMotion ? {} : {
    textShadow: [
      "0px 0px 0px rgba(0,0,0,0)",
      "-2px 0px 0px #ef4444, 2px 0px 0px #06b6d4",
      "2px 0px 0px #ef4444, -2px 0px 0px #06b6d4",
      "0px 0px 0px rgba(0,0,0,0)",
      "0px 0px 0px rgba(0,0,0,0)",
    ],
    x: [0, -1, 1, 0, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      repeatType: "loop" as const,
      repeatDelay: 5,
      times: [0, 0.05, 0.1, 0.15, 1]
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-stone-900 dark:via-black dark:to-stone-900">

      {/* Decor: Animated Concentric Circles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
         {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-zinc-900 dark:border-zinc-100"
            style={{
                width: `${i * 30}vh`,
                height: `${i * 30}vh`,
            }}
            animate={{
                scale: [1, 1.05, 1],
                rotate: i % 2 === 0 ? 360 : -360,
            }}
            transition={{
                duration: 60 + i * 20,
                repeat: Infinity,
                ease: "linear"
            }}
          />
         ))}
      </div>

      <motion.div
        className="z-10 w-full max-w-md px-6 text-center flex flex-col items-center space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Headline with Glitch */}
        <motion.div variants={itemVariants} className="relative">
            <motion.h1
                className="font-serif text-5xl md:text-6xl font-bold tracking-tighter text-zinc-900 dark:text-zinc-50 cursor-default"
                animate={glitchAnimation}
            >
                404: Coordinate Not Found.
            </motion.h1>
        </motion.div>

        {/* Pitch */}
        <motion.p variants={itemVariants} className="text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed">
            You found the backdoor to Cubit To-Do... Infinite granularity.
        </motion.p>

        {/* Form or Success Card */}
        <div className="w-full relative min-h-[120px] flex items-center justify-center">
            <AnimatePresence mode="wait">
                {isSuccess ? (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center justify-center space-y-3 p-6 bg-white/50 dark:bg-zinc-800/30 backdrop-blur-sm rounded-lg border border-zinc-200 dark:border-zinc-700 w-full shadow-sm"
                    >
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                             <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                            Signal Received. Welcome to the Inner Circle.
                        </p>
                    </motion.div>
                ) : (
                    <motion.form
                        key="form"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, filter: 'blur(10px)' }}
                        onSubmit={handleSubmit}
                        className="w-full flex flex-col space-y-6"
                    >
                        <div className="relative group w-full">
                            <input
                                type="email"
                                name="email"
                                placeholder="Enter your email coordinates..."
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isSubmitting}
                                className="bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:border-indigo-600 dark:focus:border-indigo-500 outline-none w-full py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 transition-colors disabled:opacity-50"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center py-2 px-4 rounded-md transition-all group"
                        >
                            {isSubmitting ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400"
                                >
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm font-medium">Transmitting...</span>
                                </motion.div>
                            ) : (
                                <span className="text-zinc-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-medium flex items-center gap-2 text-sm transition-colors">
                                    Transmit Signal <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </span>
                            )}
                        </button>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>

        {/* Return Link */}
        <motion.div variants={itemVariants} className="pt-8">
            <Link
                href="/"
                className="text-xs uppercase tracking-widest text-zinc-400 hover:text-indigo-600 dark:text-zinc-500 dark:hover:text-indigo-400 transition-colors"
            >
                Return to Engine
            </Link>
        </motion.div>

      </motion.div>
    </div>
  );
}
