import { useState, ChangeEvent } from 'react';
import { UploadCloud, FileText, Video, AlertCircle, AlertTriangle } from 'lucide-react';
import { GemininService } from '@/services/gemini';
import { useAppStore } from '@/store/useAppStore';

interface UploadZoneProps {
    onVideoSelected: (file: File) => void;
    onTranscriptParsed: (transcriptText: string) => void;
}

export default function UploadZone({ onVideoSelected, onTranscriptParsed }: UploadZoneProps) {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [transcriptContent, setTranscriptContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showHevcWarning, setShowHevcWarning] = useState(false);

    const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Basic validation
            if (!file.type.startsWith('video/')) {
                setError("Please select a valid video file.");
                return;
            }

            // Size Limit (500MB)
            const MAX_SIZE = 500 * 1024 * 1024; // 500MB
            if (file.size > MAX_SIZE) {
                alert("Video too large for browser processing (Max 500MB). Please compress the file.");
                setError("File exceeds 500MB limit.");
                return;
            }

            // HEVC Check
            const testVid = document.createElement('video');
            const canPlayHevc = testVid.canPlayType('video/mp4; codecs="hvc1"');
            if (canPlayHevc === "") {
                setShowHevcWarning(true);
            } else {
                setShowHevcWarning(false);
            }

            setVideoFile(file);
            onVideoSelected(file); // Lift state up immediately for the hook
            setError(null);
        }
    };

    const handleVttChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                if (text) {
                    // Validate loosely that it looks like text
                    if (text.length < 10) {
                        setError("Transcript file seems empty.");
                        return;
                    }
                    setTranscriptContent(text);
                    setError(null);
                }
            };
            reader.onerror = () => setError("Failed to read transcript file.");
            reader.readAsText(file);
        }
    };

    const handleAnalyze = () => {
        if (videoFile && transcriptContent) {
            onTranscriptParsed(transcriptContent);
        }
    };

    const isReady = !!videoFile && !!transcriptContent;

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
            <div className="w-full max-w-2xl text-center space-y-8">

                <div className="space-y-2">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        Cubit Connect
                    </h1>
                    <p className="text-zinc-400">
                        AI-Powered Video Documentation. <br />
                        Select your screen recording and transcript to begin.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Video Input */}
                    <label className={`
            relative group flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all
            ${videoFile ? 'border-green-500/50 bg-green-500/5' : 'border-zinc-700 hover:border-blue-500/50 hover:bg-zinc-800/50'}
          `}>
                        <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
                        <div className="p-4 rounded-full bg-zinc-900 mb-4 group-hover:scale-110 transition-transform">
                            <Video className={videoFile ? "w-8 h-8 text-green-400" : "w-8 h-8 text-zinc-400"} />
                        </div>
                        <span className="text-sm font-medium text-zinc-300">
                            {videoFile ? videoFile.name : "Select Video (MP4/WebM)"}
                        </span>
                    </label>

                    {/* Transcript Input */}
                    <label className={`
            relative group flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all
            ${transcriptContent ? 'border-purple-500/50 bg-purple-500/5' : 'border-zinc-700 hover:border-purple-500/50 hover:bg-zinc-800/50'}
          `}>
                        <input type="file" accept=".vtt,.srt" onChange={handleVttChange} className="hidden" />
                        <div className="p-4 rounded-full bg-zinc-900 mb-4 group-hover:scale-110 transition-transform">
                            <FileText className={transcriptContent ? "w-8 h-8 text-purple-400" : "w-8 h-8 text-zinc-400"} />
                        </div>
                        <span className="text-sm font-medium text-zinc-300">
                            {transcriptContent ? "Transcript Loaded" : "Select Transcript (VTT)"}
                        </span>
                    </label>
                </div>

                {error && (
                    <div className="flex items-center justify-center gap-2 text-red-400 bg-red-950/20 p-3 rounded-lg">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {/* HEVC Warning */}
                {showHevcWarning && (
                    <div className="w-full max-w-sm bg-amber-900/30 border border-amber-500/50 p-3 rounded-lg flex items-start gap-3 text-left mb-4">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-200">
                            <span className="font-bold">iPhone/HEVC Detected:</span> This video format may show a black screen on Windows.
                            If screenshots fail, please convert to standard MP4 (H.264).
                        </div>
                    </div>
                )}

                <button
                    onClick={handleAnalyze}
                    disabled={!isReady}
                    className={`
                w-full max-w-sm py-4 rounded-xl font-bold text-lg shadow-xl transition-all
                ${isReady
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:scale-105 hover:shadow-blue-500/20 text-white'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}
            `}
                >
                    Start Analysis
                </button>

            </div>
        </div>
    );
}
