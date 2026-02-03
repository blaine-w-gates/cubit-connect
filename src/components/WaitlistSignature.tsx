'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WaitlistSignatureProps {
  onUnlock: () => void;
  isUnlocked: boolean;
}

export default function WaitlistSignature({ onUnlock, isUnlocked }: WaitlistSignatureProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Hydration Fix
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Logic Risk: Trim inputs
    const cleanEmail = (email || '').trim();

    // 2. Logic Risk: Strict Regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please sign with a valid email address.');
      return;
    }

    // 3. Logic Risk: Private Mode / Storage
    try {
      localStorage.setItem('cubit_waitlist_signed', 'true');
      localStorage.setItem('cubit_user_email', cleanEmail);
    } catch (err) {
      console.warn('Storage restricted (Private Mode?)', err);
      // Fallback: Proceed anyway in session
    }

    onUnlock();
  };

  if (!mounted) return null;

  return (
    <div className="w-full relative py-8">
      {/* STATE A: The Gate (Unsigned) */}
      {!isUnlocked && (
        <div className="border-t-2 border-dashed border-black/30 mt-8 pt-8">
          <div className="max-w-md mx-auto text-center space-y-6">
            <p className="font-serif italic text-xl text-black">
              &quot;I verify that I have distilled this knowledge into action.&quot;
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email to sign..."
                  className="w-full bg-transparent border-b-2 border-black py-2 px-4 text-center font-mono text-lg outline-none placeholder:text-zinc-400 focus:bg-yellow-50/50 transition-colors rounded-none appearance-none"
                />
                {error && (
                  <span className="absolute -bottom-6 left-0 right-0 text-xs text-red-600 font-mono">
                    {error}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="mx-auto mt-4 px-8 py-3 bg-black text-[#FAFAFA] font-mono uppercase tracking-widest text-sm hover:bg-zinc-800 transition-colors active:scale-95"
              >
                Sign Permanent Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STATE B: The Stamp (Signed) */}
      <AnimatePresence>
        {isUnlocked && (
          <motion.div
            initial={{ scale: 3, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: -12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            className="absolute top-0 right-10 pointer-events-none z-50 mix-blend-multiply"
          >
            <div
              className="border-4 border-red-700 text-red-700 px-4 py-2 font-black text-4xl font-serif tracking-widest uppercase opacity-80 rounded-md"
              style={{ transform: 'rotate(-12deg)' }}
            >
              PROCESSED
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
