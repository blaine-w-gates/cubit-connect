'use client';

import { useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

interface FileUploadState {
  name: string | null;
  error: string | null;
}

export function UploadZone() {
  const videoFile = useAppStore((state) => state.videoFile);
  const transcript = useAppStore((state) => state.transcript);
  const setVideoFile = useAppStore((state) => state.setVideoFile);
  const setTranscript = useAppStore((state) => state.setTranscript);

  const [videoState, setVideoState] = useState<FileUploadState>({
    name: videoFile?.name || null,
    error: null,
  });
  const [transcriptState, setTranscriptState] = useState<FileUploadState>({
    name: transcript ? 'Transcript loaded' : null,
    error: null,
  });

  const videoInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate video type
    if (!file.type.startsWith('video/')) {
      setVideoState({ name: null, error: 'Please select a valid video file' });
      return;
    }

    setVideoFile(file);
    setVideoState({ name: file.name, error: null });
  };

  const handleTranscriptSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['vtt', 'srt'].includes(extension)) {
      setTranscriptState({ name: null, error: 'Please select a .vtt or .srt file' });
      return;
    }

    try {
      const text = await readFileAsText(file);
      setTranscript(text);
      setTranscriptState({ name: file.name, error: null });
    } catch (error) {
      console.error('[UploadZone] Failed to read transcript:', error);
      setTranscriptState({ name: null, error: 'Failed to read file' });
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setVideoState({ name: file.name, error: null });
    } else {
      setVideoState({ name: null, error: 'Please drop a valid video file' });
    }
  };

  const handleTranscriptDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension && ['vtt', 'srt'].includes(extension)) {
      try {
        const text = await readFileAsText(file);
        setTranscript(text);
        setTranscriptState({ name: file.name, error: null });
      } catch {
        setTranscriptState({ name: null, error: 'Failed to read file' });
      }
    } else {
      setTranscriptState({ name: null, error: 'Please drop a .vtt or .srt file' });
    }
  };

  const preventDefault = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Video Upload */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6
          transition-colors duration-200
          ${videoState.name 
            ? 'border-green-300 bg-green-50' 
            : videoState.error 
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
          }
        `}
        onDragOver={preventDefault}
        onDragEnter={preventDefault}
        onDrop={handleVideoDrop}
      >
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          className="hidden"
        />

        <div className="text-center">
          <div className="text-4xl mb-3">
            {videoState.name ? '🎬' : '📹'}
          </div>
          <p className="font-medium text-gray-900 mb-1">
            {videoState.name ? 'Video Selected' : 'Video File'}
          </p>
          
          {videoState.name ? (
            <p className="text-sm text-green-700 mb-3 truncate max-w-full">
              {videoState.name}
            </p>
          ) : videoState.error ? (
            <p className="text-sm text-red-600 mb-3">{videoState.error}</p>
          ) : (
            <p className="text-sm text-gray-500 mb-3">
              Drop MP4 or click to browse
            </p>
          )}

          <button
            onClick={() => videoInputRef.current?.click()}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${videoState.name
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {videoState.name ? 'Change' : 'Select Video'}
          </button>
        </div>
      </div>

      {/* Transcript Upload */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6
          transition-colors duration-200
          ${transcriptState.name 
            ? 'border-green-300 bg-green-50' 
            : transcriptState.error 
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
          }
        `}
        onDragOver={preventDefault}
        onDragEnter={preventDefault}
        onDrop={handleTranscriptDrop}
      >
        <input
          ref={transcriptInputRef}
          type="file"
          accept=".vtt,.srt"
          onChange={handleTranscriptSelect}
          className="hidden"
        />

        <div className="text-center">
          <div className="text-4xl mb-3">
            {transcriptState.name ? '📝' : '📄'}
          </div>
          <p className="font-medium text-gray-900 mb-1">
            {transcriptState.name ? 'Transcript Loaded' : 'Transcript File'}
          </p>
          
          {transcriptState.name ? (
            <p className="text-sm text-green-700 mb-3 truncate max-w-full">
              {transcriptState.name}
            </p>
          ) : transcriptState.error ? (
            <p className="text-sm text-red-600 mb-3">{transcriptState.error}</p>
          ) : (
            <p className="text-sm text-gray-500 mb-3">
              Drop VTT/SRT or click to browse
            </p>
          )}

          <button
            onClick={() => transcriptInputRef.current?.click()}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${transcriptState.name
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {transcriptState.name ? 'Change' : 'Select Transcript'}
          </button>
        </div>
      </div>
    </div>
  );
}
