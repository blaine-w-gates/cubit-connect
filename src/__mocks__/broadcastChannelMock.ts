/**
 * BroadcastChannel Mock for Testing
 * 
 * Per Gemini directive #3: Manual mock for JSDOM (which doesn't support BroadcastChannel)
 * Simulates cross-tab communication for timer ownership testing
 */

export interface MockBroadcastMessage {
  type: string;
  [key: string]: unknown;
}

type MessageHandler = (e: { data: MockBroadcastMessage }) => void;

export class MockBroadcastChannel {
  private static channels: Map<string, Set<MockBroadcastChannel>> = new Map();
  
  readonly name: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private isClosed: boolean = false;
  
  constructor(name: string) {
    this.name = name;
    
    // Register this instance in the channel
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }
  
  postMessage(message: MockBroadcastMessage): void {
    if (this.isClosed) {
      console.warn('[MockBroadcastChannel] Cannot post to closed channel');
      return;
    }
    
    // Get all other instances on the same channel
    const channelInstances = MockBroadcastChannel.channels.get(this.name);
    if (!channelInstances) return;
    
    // Deliver to all other instances (not self)
    channelInstances.forEach(instance => {
      if (instance !== this && !instance.isClosed) {
        // Simulate async delivery
        setTimeout(() => {
          instance.messageHandlers.forEach(handler => {
            handler({ data: message });
          });
        }, 0);
      }
    });
  }
  
  addEventListener(type: 'message', handler: MessageHandler): void;
  addEventListener(type: string, handler: EventListener): void;
  addEventListener(type: string, handler: MessageHandler | EventListener): void {
    if (type === 'message') {
      this.messageHandlers.add(handler as MessageHandler);
    }
  }
  
  removeEventListener(type: 'message', handler: MessageHandler): void;
  removeEventListener(type: string, handler: EventListener): void;
  removeEventListener(type: string, handler: MessageHandler | EventListener): void {
    if (type === 'message') {
      this.messageHandlers.delete(handler as MessageHandler);
    }
  }
  
  close(): void {
    this.isClosed = true;
    
    // Remove from channel registry
    const channelInstances = MockBroadcastChannel.channels.get(this.name);
    if (channelInstances) {
      channelInstances.delete(this);
      if (channelInstances.size === 0) {
        MockBroadcastChannel.channels.delete(this.name);
      }
    }
    
    // Clear handlers
    this.messageHandlers.clear();
  }
  
  // Test utility: Get all instances on this channel
  static getChannelInstances(name: string): MockBroadcastChannel[] {
    const instances = MockBroadcastChannel.channels.get(name);
    return instances ? Array.from(instances) : [];
  }
  
  // Test utility: Clear all channels
  static clearAll(): void {
    MockBroadcastChannel.channels.forEach((instances) => {
      instances.forEach(instance => {
        instance.isClosed = true;
        instance.messageHandlers.clear();
      });
    });
    MockBroadcastChannel.channels.clear();
  }
  
  // Test utility: Simulate a message to all instances (including self)
  static broadcastToAll(name: string, message: MockBroadcastMessage): void {
    const channelInstances = MockBroadcastChannel.channels.get(name);
    if (!channelInstances) return;
    
    channelInstances.forEach(instance => {
      if (!instance.isClosed) {
        instance.messageHandlers.forEach(handler => {
          handler({ data: message });
        });
      }
    });
  }
}

// Global setup for Jest/Vitest
export function setupBroadcastChannelMock(): void {
  if (typeof global !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).BroadcastChannel = MockBroadcastChannel;
  }
}

export function cleanupBroadcastChannels(): void {
  MockBroadcastChannel.clearAll();
}
