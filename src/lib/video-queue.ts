/**
 * Async Video Screenshot Queue
 * 
 * CRITICAL: This implements the "Antigravity" protocol for video frame capture.
 * Never loop through timestamps synchronously - always wait for the seeked event.
 * 
 * Pattern: seek → wait for onseeked → capture → next
 */

export interface QueueItem {
  taskId: string;
  timestamp: number;
  resolve: (base64: string) => void;
  reject: (error: Error) => void;
}

export interface ScreenshotOptions {
  maxWidth: number;
  quality: number;
}

const DEFAULT_OPTIONS: ScreenshotOptions = {
  maxWidth: 640,
  quality: 0.7,
};

export class ScreenshotQueue {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private options: ScreenshotOptions;

  constructor(options: Partial<ScreenshotOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Attach a video element to the queue
   */
  setVideo(video: HTMLVideoElement): void {
    this.video = video;
  }

  /**
   * Add a timestamp to the capture queue
   * Returns a promise that resolves with the base64 screenshot
   */
  add(taskId: string, timestamp: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskId, timestamp, resolve, reject });
      this.processNext();
    });
  }

  /**
   * Get current queue length
   */
  get pending(): number {
    return this.queue.length;
  }

  /**
   * Clear all pending items in the queue
   */
  clear(): void {
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared'));
    }
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Process the next item in the queue
   */
  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    if (!this.video) {
      const item = this.queue.shift();
      item?.reject(new Error('No video element attached'));
      this.processNext();
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift()!;

    try {
      const base64 = await this.captureFrame(item.timestamp);
      item.resolve(base64);
    } catch (error) {
      item.reject(error instanceof Error ? error : new Error('Capture failed'));
    } finally {
      this.isProcessing = false;
      // Process next item after a small delay to prevent overwhelming the browser
      setTimeout(() => this.processNext(), 50);
    }
  }

  /**
   * Capture a single frame at the specified timestamp
   * CRITICAL: Uses event-driven async pattern
   */
  private captureFrame(timestamp: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.video) {
        reject(new Error('No video element'));
        return;
      }

      const video = this.video;

      // Validate timestamp
      if (timestamp < 0 || timestamp > video.duration) {
        reject(new Error(`Invalid timestamp: ${timestamp}`));
        return;
      }

      // One-time seeked event handler
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);

        try {
          const base64 = this.drawToCanvas(video);
          resolve(base64);
        } catch (error) {
          reject(error);
        }
      };

      // Error handler
      const onError = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        reject(new Error(`Video seek error at timestamp: ${timestamp}`));
      };

      // Attach listeners BEFORE setting currentTime
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });

      // Trigger the seek
      video.currentTime = timestamp;
    });
  }

  /**
   * Draw video frame to canvas and return base64
   * Handles downscaling for memory safety
   */
  private drawToCanvas(video: HTMLVideoElement): string {
    // Create canvas lazily
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
    }

    if (!this.ctx) {
      throw new Error('Could not get canvas 2d context');
    }

    // Calculate dimensions (maintain aspect ratio, max width constraint)
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    let width = videoWidth;
    let height = videoHeight;

    // Downscale if needed (MEMORY SAFETY)
    if (width > this.options.maxWidth) {
      const ratio = this.options.maxWidth / width;
      width = this.options.maxWidth;
      height = Math.round(height * ratio);
    }

    // Set canvas size
    this.canvas.width = width;
    this.canvas.height = height;

    // Draw the frame
    this.ctx.drawImage(video, 0, 0, width, height);

    // Export as JPEG with quality setting
    const base64 = this.canvas.toDataURL('image/jpeg', this.options.quality);

    return base64;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clear();
    this.video = null;
    this.canvas = null;
    this.ctx = null;
  }
}

/**
 * Singleton instance for app-wide use
 */
let queueInstance: ScreenshotQueue | null = null;

export function getScreenshotQueue(options?: Partial<ScreenshotOptions>): ScreenshotQueue {
  if (!queueInstance) {
    queueInstance = new ScreenshotQueue(options);
  }
  return queueInstance;
}

export function resetScreenshotQueue(): void {
  if (queueInstance) {
    queueInstance.destroy();
    queueInstance = null;
  }
}
