'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight } from 'lucide-react';

export default function IgnitionForm() {
  const [status, setStatus] = useState<'idle' | 'igniting'>('idle');
  const router = useRouter();

  const handleIgnite = async () => {
    setStatus('igniting');
    // In the zero-trust architecture, the server handles API key validation.
    // We simply redirect the user directly to the engine workspace.
    setTimeout(() => {
      router.push('/engine');
    }, 400); // Small delay for the animation
  };

  return (
    <section className="w-full max-w-xl mx-auto" aria-label="Start Engine">
      <div className="flex flex-col md:flex-row gap-0 border border-zinc-300 p-1 rounded-sm bg-white shadow-lg transition-all hover:ring-2 hover:ring-black/5">
        <label htmlFor="ignition-btn" className="sr-only">
          Start Engine
        </label>
        <div className="flex-1 bg-transparent border-none text-zinc-900 px-6 py-4 font-mono text-sm w-full flex items-center text-zinc-600">
          Server Connection Secured. Ready to operate.
        </div>
        <button
          id="ignition-btn"
          onClick={handleIgnite}
          disabled={status === 'igniting'}
          className="px-8 py-4 font-bold font-mono tracking-widest transition-all flex items-center justify-center gap-2 min-w-[140px] rounded-sm bg-zinc-900 text-white hover:bg-black"
        >
          {status === 'igniting' ? (
            <Loader2 className="animate-spin w-4 h-4" />
          ) : (
            <>
              START <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
      <p className="mt-4 text-[10px] text-zinc-600 font-mono uppercase tracking-widest text-center">
        * Running on local protected proxy
      </p>
    </section>
  );
}
