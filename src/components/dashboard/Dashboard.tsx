'use client';

import { useAppStore } from '@/store/useAppStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { UploadZone } from './UploadZone';
import { VideoPlayer } from './VideoPlayer';
import { TaskList } from './TaskList';

export function Dashboard() {
  const videoFile = useAppStore((state) => state.videoFile);
  const transcript = useAppStore((state) => state.transcript);
  const tasks = useAppStore((state) => state.tasks);
  const isProcessing = useAppStore((state) => state.isProcessing);
  const processingProgress = useAppStore((state) => state.processingProgress);
  const processingStatus = useAppStore((state) => state.processingStatus);
  const error = useAppStore((state) => state.error);
  const needsVideoRehydration = useAppStore((state) => state.needsVideoRehydration);

  const { startAnalysis } = useAnalysis();

  // Check if ready for analysis
  const canStartAnalysis = videoFile && transcript && !isProcessing;
  const hasTasks = tasks && tasks.length > 0;

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">❌</span>
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Video Rehydration Warning */}
      {needsVideoRehydration && !videoFile && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-amber-900">Resume Your Project</p>
              <p className="text-sm text-amber-700 mt-1">
                Your previous work was saved, but the video file needs to be re-selected.
                Please upload the same video to continue.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Upload Files
        </h2>
        <UploadZone />
      </section>

      {/* Video Preview */}
      {videoFile && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Video Preview
          </h2>
          <VideoPlayer file={videoFile} />
        </section>
      )}

      {/* Analysis Button & Progress */}
      <section className="pt-4">
        {isProcessing ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-4">
              <span className="animate-spin h-6 w-6 border-3 border-blue-600 border-t-transparent rounded-full" />
              <div>
                <p className="font-medium text-gray-900">{processingStatus || 'Processing...'}</p>
                <p className="text-sm text-gray-500">{processingProgress}% complete</p>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={startAnalysis}
            disabled={!canStartAnalysis}
            className={`
              w-full py-4 px-6 rounded-xl font-semibold text-lg
              transition-all duration-200
              ${canStartAnalysis
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            <span className="flex items-center justify-center gap-2">
              <span>🚀</span>
              {hasTasks ? 'Re-Analyze' : 'Start Analysis'}
            </span>
          </button>
        )}

        {!canStartAnalysis && !isProcessing && !hasTasks && (
          <p className="text-center text-sm text-gray-500 mt-2">
            {!videoFile && !transcript 
              ? 'Upload a video and transcript to begin'
              : !videoFile 
                ? 'Upload a video file to continue'
                : 'Upload a transcript file to continue'
            }
          </p>
        )}
      </section>

      {/* Task Results */}
      {hasTasks && (
        <section className="pt-4">
          <TaskList tasks={tasks} />
        </section>
      )}
    </div>
  );
}
