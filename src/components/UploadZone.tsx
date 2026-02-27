import { useState, ChangeEvent } from 'react';
import { FileText, Video, AlertCircle, AlertTriangle, FileType } from 'lucide-react';
import { toast } from 'sonner';

import { useAppStore } from '@/store/useAppStore';

interface UploadZoneProps {
  onVideoSelected: (file: File) => void;
  onTranscriptParsed: (transcriptText: string) => void;
  footerContent?: React.ReactNode;
}

export default function UploadZone({
  onVideoSelected,
  onTranscriptParsed,
  footerContent,
}: UploadZoneProps) {
  const { projectType, setProjectType, setProjectTitle, startTextProject } = useAppStore();

  // Mode State - Derived from Store (Single Source of Truth)
  const mode = projectType;
  const setMode = setProjectType;

  // Video Mode State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transcriptContent, setTranscriptContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHevcWarning, setShowHevcWarning] = useState(false);

  // Drag State
  const [dragActive, setDragActive] = useState(false);

  const processVideo = (file: File) => {
    // Basic validation
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file.');
      return;
    }

    // Size Limit (500MB)
    const MAX_SIZE = 500 * 1024 * 1024; // 500MB
    if (file.size > MAX_SIZE) {
      toast.error('File is too large (Max 500MB)', {
        description: 'Please compress the video before uploading to prevent browser crash.',
      });
      setError('File exceeds 500MB limit.');
      return;
    }

    // HEVC Check
    const testVid = document.createElement('video');
    const canPlayHevc = testVid.canPlayType('video/mp4; codecs="hvc1"');
    if (canPlayHevc === '') {
      setShowHevcWarning(true);
    } else {
      setShowHevcWarning(false);
    }

    setVideoFile(file);
    onVideoSelected(file);
    setError(null);
  };

  const processTranscript = (file: File) => {
    // Validation: Check extension
    const validExtensions = ['.vtt', '.srt', '.txt'];
    const fileName = file.name.toLowerCase();
    const isValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValidExtension && !file.type.startsWith('text/')) {
      setError('Invalid Transcript Format. Please use .vtt or .srt files.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        if (text.length < 10) {
          setError('Transcript file seems empty.');
          return;
        }
        setTranscriptContent(text);
        setError(null);
      }
    };
    reader.onerror = () => setError('Failed to read transcript file.');
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDropVideo = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processVideo(e.dataTransfer.files[0]);
    }
  };

  const handleDropTranscript = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processTranscript(e.dataTransfer.files[0]);
    }
  };

  // Text Mode State
  const [titleInput, setTitleInput] = useState('');
  const [textInput, setTextInput] = useState('');

  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processVideo(file);
  };

  const handleVttChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processTranscript(file);
  };

  const handleAnalyze = async () => {
    if (mode === 'video') {
      if (videoFile && transcriptContent) {
        // Set metadata for Video Mode
        await setProjectType('video');
        await setProjectTitle(videoFile.name.replace(/\.[^/.]+$/, '')); // Remove extension
        onTranscriptParsed(transcriptContent);
      }
    } else {
      // Text Mode
      if (titleInput && textInput) {
        const cleanedText = textInput.trim().replace(/\n{3,}/g, '\n\n');

        // Atomic Store Update (Prevents IDB Race Conditions)
        await startTextProject(titleInput, cleanedText);

        // Trigger Engine via Parent hook (simulating a "parsed transcript")
        onTranscriptParsed(cleanedText);
      }
    }
  };

  const isReady =
    mode === 'video'
      ? !!videoFile && !!transcriptContent
      : titleInput.length > 2 && textInput.length > 50;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <div className="w-full max-w-2xl text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-zinc-900 dark:text-white">Cubit Connect</h1>
          <p className="text-zinc-700 dark:text-zinc-500">
            AI-Powered Documentation & Knowledge Distillation. <br />
            Select your source material to begin.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center mb-6">
          <div className="bg-zinc-100 dark:bg-zinc-800/80 p-1.5 rounded-xl flex gap-1 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm">
            <button
              onClick={() => setMode('video')}
              className={`px-6 py-2 rounded-lg text-sm font-bold tracking-wide transition-all flex items-center gap-2 ${mode === 'video'
                ? 'bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-600 dark:text-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.25)] border-transparent'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
                }`}
            >
              <Video className="w-4 h-4" />
              Video Mode
            </button>
            <button
              onClick={() => setMode('text')}
              className={`px-6 py-2 rounded-lg text-sm font-bold tracking-wide transition-all flex items-center gap-2 ${mode === 'text'
                ? 'bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-600 dark:text-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.25)] border-transparent'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
                }`}
            >
              <FileType className="w-4 h-4" />
              Text Mode
            </button>
          </div>
        </div>

        {/* VIDEO MODE UI */}
        {mode === 'video' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
            {/* Video Input */}
            <label
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDropVideo}
              className={`
                                relative group flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
                                ${videoFile
                  ? 'border-fuchsia-500 bg-fuchsia-50/50 dark:bg-fuchsia-900/20 shadow-[0_0_15px_rgba(217,70,239,0.15)]'
                  : dragActive
                    ? 'border-fuchsia-400 bg-zinc-100 dark:bg-zinc-800 scale-[1.02] shadow-[0_0_20px_rgba(217,70,239,0.2)]'
                    : 'bg-white dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-700 hover:border-fuchsia-500/60 hover:bg-fuchsia-50/30 dark:hover:bg-fuchsia-900/10 hover:shadow-[0_0_15px_rgba(217,70,239,0.1)]'
                }
                            `}
            >
              <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
              <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4 group-hover:scale-110 transition-transform border border-zinc-200 dark:border-zinc-700">
                <Video
                  className={
                    videoFile
                      ? 'w-8 h-8 text-fuchsia-600'
                      : 'w-8 h-8 text-zinc-400 dark:text-zinc-500'
                  }
                />
              </div>
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                {videoFile
                  ? videoFile.name
                  : dragActive
                    ? 'Drop Video Here'
                    : 'Select Video (MP4/WebM)'}
              </span>
            </label>

            {/* Transcript Input */}
            <label
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDropTranscript}
              className={`
                                relative group flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
                                ${transcriptContent
                  ? 'border-fuchsia-500 bg-fuchsia-50/50 dark:bg-fuchsia-900/20 shadow-[0_0_15px_rgba(217,70,239,0.15)]'
                  : dragActive
                    ? 'border-fuchsia-400 bg-zinc-100 dark:bg-zinc-800 scale-[1.02] shadow-[0_0_20px_rgba(217,70,239,0.2)]'
                    : 'bg-white dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-700 hover:border-fuchsia-500/60 hover:bg-fuchsia-50/30 dark:hover:bg-fuchsia-900/10 hover:shadow-[0_0_15px_rgba(217,70,239,0.1)]'
                }
                            `}
            >
              <input type="file" accept=".vtt,.srt" onChange={handleVttChange} className="hidden" />
              <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4 group-hover:scale-110 transition-transform border border-zinc-200 dark:border-zinc-700">
                <FileText
                  className={
                    transcriptContent
                      ? 'w-8 h-8 text-purple-600'
                      : 'w-8 h-8 text-zinc-400 dark:text-zinc-500'
                  }
                />
              </div>
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                {transcriptContent
                  ? 'Transcript Loaded'
                  : dragActive
                    ? 'Drop VTT Here'
                    : 'Select Transcript (VTT)'}
              </span>
            </label>
          </div>
        )}

        {/* TEXT MODE UI */}
        {mode === 'text' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <input
              type="text"
              placeholder="Project Title (e.g. Sourdough Guide)"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl p-4 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
            />
            <textarea
              placeholder="Paste your text content here (Reddit thread, Blog post, Documentation)..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="w-full h-48 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl p-4 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 resize-none font-mono text-sm"
            />
            <div className="text-xs text-zinc-500 text-right">{textInput.length} chars</div>
          </div>
        )}

        {/* Shared Errors */}
        {error && (
          <div className="flex items-center justify-center gap-2 text-red-400 bg-red-950/20 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* HEVC Warning (Video Only) */}
        {showHevcWarning && mode === 'video' && (
          <div className="w-full max-w-sm bg-amber-900/30 border border-amber-500/50 p-3 rounded-lg flex items-start gap-3 text-left mb-4 mx-auto">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <span className="font-bold">iPhone/HEVC Detected:</span> This video format may show a
              black screen.
            </div>
          </div>
        )}

        {/* The Footer Stack - Keeps spacing consistent regardless of warnings above */}
        <div className="flex flex-col items-center gap-6 mt-6 w-full max-w-sm mx-auto">
          <button
            onClick={handleAnalyze}
            disabled={!isReady}
            className={`
                        w-full py-4 rounded-xl font-bold text-lg outline-none transition-all duration-300 relative overflow-hidden group
                        ${isReady
                ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_25px_rgba(217,70,239,0.5)] hover:scale-[1.02]'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
              }
                    `}
          >
            {/* Hover Glare Effect */}
            {isReady && (
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:animate-[glare_1s_ease-in-out_forwards] skew-x-[-20deg]" />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide font-sans">
              Start Analysis
            </span>
          </button>
          {footerContent}
        </div>
      </div>
    </div>
  );
}
