'use client';

import { motion } from 'framer-motion';

/**
 * ParticleBurst — Celebration particle animation when a task is completed.
 *
 * Extracted from TodoTable.tsx as part of component decomposition (#26).
 * Pure presentational component — no store dependencies.
 */
export function ParticleBurst() {
    return (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-50">
            {Array.from({ length: 8 }).map((_, i) => {
                const angle = (i * 360) / 8;
                const rad = (angle * Math.PI) / 180;
                const tx = Math.cos(rad) * 40;
                const ty = Math.sin(rad) * 40;
                return (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50"
                        initial={{ scale: 1, x: 0, y: 0, opacity: 1 }}
                        animate={{
                            scale: 0,
                            x: tx,
                            y: ty,
                            opacity: 0,
                        }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                );
            })}
        </div>
    );
}
