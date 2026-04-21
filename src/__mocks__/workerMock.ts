/**
 * Web Worker Mock for Testing
 * 
 * Per Gemini directive #3: Manual mock for JSDOM (which doesn't support Web Workers)
 * Used in P1-T9 unit tests for useTimerWorker hook
 */

export interface MockWorkerMessage {
  type: string;
  payload?: Record<string, unknown>;
}

export class MockWorker {
  private messageHandler: ((e: MessageEvent<MockWorkerMessage>) => void) | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private duration: number = 0;
  private startedAt: number = 0;
  private pausedDuration: number = 0;
  private isPaused: boolean = false;
  private pauseStartTime: number = 0;
  
  // Static registry to track all mock workers
  static instances: MockWorker[] = [];
  
  constructor() {
    MockWorker.instances.push(this);
  }
  
  postMessage(message: MockWorkerMessage): void {
    const { type, payload } = message;
    
    switch (type) {
      case 'START': {
        if (payload?.durationMs !== undefined && payload?.startedAt !== undefined) {
          this.duration = payload.durationMs as number;
          this.startedAt = payload.startedAt as number;
          this.pausedDuration = (payload.totalPausedMs as number) || 0;
          this.isPaused = false;
          this.startInterval();
        }
        break;
      }
      
      case 'PAUSE': {
        if (!this.isPaused) {
          this.isPaused = true;
          this.pauseStartTime = performance.now();
        }
        break;
      }
      
      case 'RESUME': {
        if (this.isPaused) {
          const now = performance.now();
          this.pausedDuration += now - this.pauseStartTime;
          this.isPaused = false;
        }
        break;
      }
      
      case 'STOP': {
        this.stopInterval();
        break;
      }
      
      case 'GET_STATUS': {
        this.sendStatus();
        break;
      }
    }
  }
  
  private startInterval(): void {
    this.stopInterval();
    
    // Send initial tick
    this.sendTick();
    
    this.intervalId = setInterval(() => {
      if (this.isPaused) return;
      
      this.sendTick();
      
      const now = performance.now();
      const elapsed = now - this.startedAt - this.pausedDuration;
      const remaining = Math.max(0, this.duration - elapsed);
      
      if (remaining <= 0) {
        this.stopInterval();
        this.messageHandler?.({ data: { type: 'COMPLETE' } } as MessageEvent<MockWorkerMessage>);
      }
    }, 1000);
  }
  
  private stopInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  private sendTick(): void {
    const now = performance.now();
    const elapsed = this.isPaused 
      ? this.pauseStartTime - this.startedAt - this.pausedDuration
      : now - this.startedAt - this.pausedDuration;
    
    const remainingMs = Math.max(0, this.duration - elapsed);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const progressPercentage = (elapsed / this.duration) * 100;
    
    this.messageHandler?.({
      data: {
        type: 'TICK',
        payload: {
          remainingMs,
          remainingSeconds,
          progressPercentage,
        },
      },
    } as unknown as MessageEvent<MockWorkerMessage>);
  }
  
  private sendStatus(): void {
    const now = performance.now();
    const elapsed = this.isPaused 
      ? this.pauseStartTime - this.startedAt - this.pausedDuration
      : now - this.startedAt - this.pausedDuration;
    
    const remainingMs = Math.max(0, this.duration - elapsed);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    
    this.messageHandler?.({
      data: {
        type: 'STATUS',
        payload: {
          status: this.isPaused ? 'paused' : this.intervalId ? 'running' : 'idle',
          remainingMs,
          remainingSeconds,
        },
      },
    } as unknown as MessageEvent<MockWorkerMessage>);
  }
  
  addEventListener(type: 'message', handler: (e: MessageEvent<MockWorkerMessage>) => void): void {
    if (type === 'message') {
      this.messageHandler = handler;
    }
  }
  
  removeEventListener(type: 'message', handler: (e: MessageEvent<MockWorkerMessage>) => void): void {
    if (type === 'message' && this.messageHandler === handler) {
      this.messageHandler = null;
    }
  }
  
  terminate(): void {
    this.stopInterval();
    this.messageHandler = null;
    const index = MockWorker.instances.indexOf(this);
    if (index > -1) {
      MockWorker.instances.splice(index, 1);
    }
  }
  
  // Test utility: Simulate a tick
  simulateTick(remainingSeconds: number): void {
    this.messageHandler?.({
      data: {
        type: 'TICK',
        payload: {
          remainingMs: remainingSeconds * 1000,
          remainingSeconds,
          progressPercentage: 0,
        },
      },
    } as unknown as MessageEvent<MockWorkerMessage>);
  }
  
  // Test utility: Simulate completion
  simulateComplete(): void {
    this.stopInterval();
    this.messageHandler?.({ data: { type: 'COMPLETE' } } as unknown as MessageEvent<MockWorkerMessage>);
  }
}

// Global setup for Jest/Vitest
export function setupWorkerMock(): void {
  if (typeof global !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).Worker = MockWorker;
  }
}

export function cleanupWorkers(): void {
  // Terminate all mock workers
  MockWorker.instances.forEach(worker => worker.terminate());
  MockWorker.instances = [];
}
