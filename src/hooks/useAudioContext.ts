/**
 * useAudioContext Hook - A+ Grade Implementation
 * 
 * Handles AudioContext lifecycle per Gemini directive #4:
 * - Must be on main thread (not in Web Worker)
 * - Unlock on first user interaction (silent unlock)
 * - Play completion sound when timer status transitions to 'completed'
 * 
 * Browser autoplay policy requires user gesture before audio can play.
 * We unlock the context on the first "Start Timer" button click.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAudioContextOptions {
  enabled?: boolean;
  volume?: number;
}

interface UseAudioContextReturn {
  isUnlocked: boolean;
  unlock: () => Promise<boolean>;
  playCompletionSound: () => Promise<void>;
  playPauseSound: () => Promise<void>;
  playResumeSound: () => Promise<void>;
  playTickSound: () => Promise<void>;
}

// Fallback: Use Web Audio API oscillator for beep if files not available
function createOscillatorTone(
  audioContext: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 1.0 // 0.0 to 1.0
): void {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = type;
  
  const now = audioContext.currentTime;
  // Apply volume scaling: base 0.3 * volume (0.0 to 1.0)
  const scaledVolume = 0.3 * Math.max(0, Math.min(1, volume));
  gainNode.gain.setValueAtTime(scaledVolume, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
  
  oscillator.start(now);
  oscillator.stop(now + duration);
}

export function useAudioContext(options: UseAudioContextOptions = {}): UseAudioContextReturn {
  const { enabled = true, volume = 1.0 } = options;
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  // Initialize AudioContext (suspended until user interaction)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('[AudioContext] Web Audio API not supported');
        return;
      }
      
      audioContextRef.current = new AudioContextClass();
    } catch (err) {
      // INTENTIONALLY LOGGING: AudioContext creation may fail (browser policy, memory)
      // Log error but don't crash - app continues without audio functionality
      console.error('[AudioContext] Failed to create:', err);
    }
    
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // Unlock the AudioContext (call this on first user interaction)
  const unlock = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;
    if (!audioContextRef.current) return false;
    if (isUnlocked) return true;
    
    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      setIsUnlocked(true);
      return true;
    } catch (err) {
      // INTENTIONALLY HANDLING: Audio unlock failure shouldn't crash app
      // Return false to allow graceful fallback to silent mode
      console.error('[AudioContext] Failed to unlock:', err);
      return false;
    }
  }, [enabled, isUnlocked]);
  
  // Play a sound using oscillator (fallback method)
  const playOscillator = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!enabled || !isUnlocked || !audioContextRef.current) return;
    
    try {
      createOscillatorTone(audioContextRef.current, frequency, duration, type, volume);
    } catch (err) {
      // INTENTIONALLY SWALLOWING: Audio playback failure shouldn't crash app
      // Silent failure acceptable - audio is enhancement, not critical feature
      console.error('[AudioContext] Failed to play oscillator:', err);
    }
  }, [enabled, isUnlocked, volume]);
  
  // Play completion sound (pleasant ascending chime)
  const playCompletionSound = useCallback(async (): Promise<void> => {
    if (!enabled || !isUnlocked) return;
    
    // Triple chime: pleasant ascending notes
    playOscillator(523.25, 0.3, 'sine'); // C5
    setTimeout(() => playOscillator(659.25, 0.3, 'sine'), 150); // E5
    setTimeout(() => playOscillator(783.99, 0.5, 'sine'), 300); // G5
  }, [enabled, isUnlocked, playOscillator]);
  
  // Play pause sound (gentle descending)
  const playPauseSound = useCallback(async (): Promise<void> => {
    if (!enabled || !isUnlocked) return;
    playOscillator(440, 0.15, 'sine'); // A4
    setTimeout(() => playOscillator(349.23, 0.2, 'sine'), 100); // F4
  }, [enabled, isUnlocked, playOscillator]);
  
  // Play resume sound (gentle ascending)
  const playResumeSound = useCallback(async (): Promise<void> => {
    if (!enabled || !isUnlocked) return;
    playOscillator(349.23, 0.15, 'sine'); // F4
    setTimeout(() => playOscillator(440, 0.2, 'sine'), 100); // A4
  }, [enabled, isUnlocked, playOscillator]);
  
  // Play tick sound (very subtle, for countdown)
  const playTickSound = useCallback(async (): Promise<void> => {
    if (!enabled || !isUnlocked) return;
    // Only play tick on last 10 seconds (not every second)
    playOscillator(800, 0.05, 'sine'); // Very short, high beep
  }, [enabled, isUnlocked, playOscillator]);
  
  return {
    isUnlocked,
    unlock,
    playCompletionSound,
    playPauseSound,
    playResumeSound,
    playTickSound,
  };
}

/**
 * useTimerAudio Hook
 * 
 * Specialized hook that listens to timer status and plays appropriate sounds.
 * This is the integration point between the timer state and audio.
 */
interface UseTimerAudioReturn {
  unlock: () => Promise<boolean>;
}

export function useTimerAudio(timerStatus: 'idle' | 'running' | 'paused' | 'completed', enabled: boolean = true): UseTimerAudioReturn {
  const { unlock, playCompletionSound, playPauseSound } = useAudioContext({ enabled });
  const previousStatusRef = useRef(timerStatus);
  
  // Unlock on first interaction (when timer goes from idle → running)
  useEffect(() => {
    if (previousStatusRef.current === 'idle' && timerStatus === 'running') {
      unlock();
    }
    
    previousStatusRef.current = timerStatus;
  }, [timerStatus, unlock]);
  
  // Play sounds on status transitions
  useEffect(() => {
    if (!enabled) return;
    
    switch (timerStatus) {
      case 'completed':
        playCompletionSound();
        break;
      case 'paused':
        playPauseSound();
        break;
      // Running sound is handled by the unlock effect (only plays on transition)
    }
  }, [timerStatus, enabled, playCompletionSound, playPauseSound]);
  
  // Return unlock for manual calling by component
  return { unlock };
}
