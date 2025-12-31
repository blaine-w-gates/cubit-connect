'use client';

import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  file: File;
}

export function VideoPlayer({ file }: VideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mainPlayerRef = useRef<HTMLVideoElement>(null);
  const hiddenProcessorRef = useRef<HTMLVideoElement>(null);

  // Create and cleanup object URL
  useEffect(() => {
    if (!file) {
      setVideoUrl(null);
      return;
    }

    try {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setError(null);

      // Cleanup: revoke URL on unmount or file change
      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error('[VideoPlayer] Failed to create object URL:', err);
      setError('Failed to load video');
    }
  }, [file]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!videoUrl) {
    return null;
  }

  return (
    <div className="bg-black rounded-xl overflow-hidden">
      {/* Main Player - Visible to user */}
      <video
        id="main-player"
        ref={mainPlayerRef}
        src={videoUrl}
        controls
        className="w-full max-h-[60vh] object-contain"
        playsInline
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>

      {/* Hidden Processor - For screenshot capture */}
      <video
        id="hidden-processor"
        ref={hiddenProcessorRef}
        src={videoUrl}
        muted
        playsInline
        preload="metadata"
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Get reference to the hidden processor video element
 * Used by the screenshot queue
 */
export function getHiddenProcessorElement(): HTMLVideoElement | null {
  return document.getElementById('hidden-processor') as HTMLVideoElement | null;
}
