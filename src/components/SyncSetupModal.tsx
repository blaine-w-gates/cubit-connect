'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Network, X, KeySquare, ShieldCheck, ShieldAlert, CheckCircle2, Loader2, Fingerprint } from 'lucide-react';

export default function SyncSetupModal() {
    const {
        isSyncModalOpen,
        setIsSyncModalOpen,
        syncStatus,
        connectToSyncServer,
        disconnectSyncServer,
        roomFingerprint,
        lastSyncedAt,
        hasUnsyncedChanges,
    } = useAppStore();

    const [passphrase, setPassphrase] = useState('');
    const [error, setError] = useState('');

    // Passphrase Strength Calculation
    const getStrength = (p: string): { score: number; label: string; color: string } => {
        if (p.length === 0) return { score: 0, label: '', color: 'bg-zinc-200 dark:bg-stone-700' };
        let score = 0;
        if (p.length >= 12) score++;
        if (p.length >= 16) score++;
        if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
        if (/[0-9]/.test(p)) score++;
        if (/[^A-Za-z0-9]/.test(p)) score++;
        if (p.length >= 20) score++;

        if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
        if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
        if (score <= 4) return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
        return { score: 4, label: 'Fortress', color: 'bg-blue-500' };
    };

    const strength = getStrength(passphrase);

    // Reset form when modal opens
    useEffect(() => {
        if (isSyncModalOpen) {
            setPassphrase('');
            setError('');
        }
    }, [isSyncModalOpen]);

    if (!isSyncModalOpen) return null;

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!passphrase || passphrase.trim().length < 12) {
            setError('Passphrase must be at least 12 characters. This is your encryption key — make it strong.');
            return;
        }

        try {
            await connectToSyncServer(passphrase.trim());
        } catch (err) {
            // INTENTIONALLY HANDLING: Connection failure shows user-friendly error
            // Error state displayed in modal for user to retry or check passphrase
            setError('Failed to establish secure connection.');
        }
    };

    const handleDisconnect = () => {
        disconnectSyncServer();
        setIsSyncModalOpen(false);
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-900/50 backdrop-blur-sm"
            onClick={() => setIsSyncModalOpen(false)}
        >
            <div
                className="bg-white dark:bg-stone-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border-t sm:border border-zinc-200 dark:border-stone-800 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto pb-8 sm:pb-0"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-stone-800">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                            <Network className="w-5 h-5" />
                        </div>
                        <h2 className="font-semibold text-zinc-900 dark:text-stone-100">Live Sync Setup</h2>
                    </div>
                    <button
                        onClick={() => setIsSyncModalOpen(false)}
                        className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-300 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-stone-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {syncStatus === 'connected' ? (
                        // CONNECTED STATE
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
                                <ShieldCheck className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-stone-100">Securely Connected</h3>
                                <p className="text-sm text-zinc-500 dark:text-stone-400 mt-1">
                                    Your tasks are syncing in real-time with End-to-End Encryption.
                                </p>
                            </div>

                            {roomFingerprint && (
                                <div className="w-full bg-zinc-50 dark:bg-stone-800/50 rounded-xl p-4 border border-zinc-200 dark:border-stone-700 mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-stone-300">
                                            <Fingerprint className="w-4 h-4 text-emerald-500" />
                                            Session Fingerprint
                                        </div>
                                    </div>
                                    <div className="text-3xl font-mono font-bold tracking-[0.2em] text-center text-emerald-600 dark:text-emerald-400 py-2">
                                        {roomFingerprint}
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-stone-400 mt-2">
                                        Verify this code matches on all your devices to ensure you are in the correct isolated room.
                                    </p>
                                </div>
                            )}

                            <div className="w-full bg-zinc-50 dark:bg-stone-800/50 rounded-xl p-4 border border-zinc-200 dark:border-stone-700">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-zinc-700 dark:text-stone-300">
                                        Last Synced
                                    </p>
                                    {hasUnsyncedChanges ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                                            Syncing pending
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Up to date
                                        </span>
                                    )}
                                </div>
                                <p className="mt-2 text-sm text-zinc-600 dark:text-stone-300">
                                    {lastSyncedAt
                                        ? new Date(lastSyncedAt).toLocaleString()
                                        : 'Waiting for first sync event...'}
                                </p>
                            </div>

                            <button
                                onClick={handleDisconnect}
                                className="w-full mt-6 py-2.5 px-4 font-semibold rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                            >
                                Disconnect & Go Offline
                            </button>
                        </div>
                    ) : (
                        // DISCONNECTED / CONNECTING STATE
                        <form onSubmit={handleConnect} className="space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm leading-relaxed border border-blue-100 dark:border-blue-900/30">
                                <strong>End-to-End Encrypted.</strong> Enter a secure passphrase. This passphrase mathematically isolates your room and encrypts your data before it ever leaves your device.
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-stone-300 mb-1.5 ml-1">
                                    Sync Passphrase
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <KeySquare className="w-5 h-5 text-zinc-400" />
                                    </div>
                                    <input
                                        type="password"
                                        value={passphrase}
                                        onChange={(e) => setPassphrase(e.target.value)}
                                        placeholder="Enter a shared secret..."
                                        disabled={syncStatus === 'connecting'}
                                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm disabled:opacity-50"
                                    />
                                </div>
                                {error && (
                                    <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1">
                                        <ShieldAlert className="w-4 h-4" /> {error}
                                    </p>
                                )}
                                {passphrase.length > 0 && (
                                    <div className="mt-3 space-y-1.5">
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4].map(i => (
                                                <div
                                                    key={i}
                                                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                                        i <= strength.score ? strength.color : 'bg-zinc-200 dark:bg-stone-700'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                        <p className={`text-xs font-medium ${
                                            strength.score <= 1 ? 'text-red-500' :
                                            strength.score <= 2 ? 'text-amber-500' :
                                            strength.score <= 3 ? 'text-emerald-500' : 'text-blue-500'
                                        }`}>
                                            {strength.label} {passphrase.length < 12 && `— ${12 - passphrase.length} more characters needed`}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-zinc-400 dark:text-stone-500 leading-relaxed">
                                Your passphrase is your <strong>encryption key</strong>. Anyone with the same passphrase can join your room and read your data. Use something long and unique — treat it like a crypto wallet seed phrase.
                            </p>

                            <button
                                type="submit"
                                disabled={syncStatus === 'connecting' || !passphrase}
                                className="w-full py-3 px-4 font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                {syncStatus === 'connecting' ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Connecting & Encrypting...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-5 h-5" />
                                        Establish Secure Connection
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
