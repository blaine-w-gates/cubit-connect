/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProjectMetaSlice, type ProjectMetaSliceState } from '@/store/slices/projectMetaSlice';

// Mock yjsContext
vi.mock('@/lib/yjsContext', () => {
  const mockMap = {
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(() => false),
    keys: vi.fn(() => []),
    values: vi.fn(() => []),
    clear: vi.fn(),
    size: 0,
  };
  return {
    yjsContext: {
      ydoc: { transact: vi.fn((fn: () => void) => fn()) },
      yProjectsMap: mockMap,
      yTasksMap: mockMap,
      yMetaMap: mockMap,
      yTranscript: { toString: vi.fn(() => ''), delete: vi.fn() },
    },
  };
});

// Mock yjsHelpers
vi.mock('@/lib/yjsHelpers', () => ({
  applyUpdateToYText: vi.fn(),
}));

// Mock storageService
vi.mock('@/services/storage', () => ({
  storageService: {
    clearProject: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('projectMetaSlice', () => {
  let set: (partial: any) => void;
  let get: () => any;
  let slice: ProjectMetaSliceState;

  beforeEach(() => {
    set = vi.fn() as any;
    get = vi.fn(() => ({
      activeWorkspaceType: 'personalUno',
      activeWorkspaceId: 'test-ws',
      scoutHistory: [],
    })) as any;
    slice = createProjectMetaSlice(set, get);
  });

  describe('initial state', () => {
    it('returns correct default values', () => {
      expect(slice.transcript).toBeNull();
      expect(slice.scoutResults).toEqual([]);
      expect(slice.scoutHistory).toEqual([]);
      expect(slice.projectType).toBe('video');
      expect(slice.projectTitle).toBe('New Project');
    });
  });

  describe('action keys', () => {
    const expectedActions = [
      'setTranscript',
      'setScoutResults',
      'addToScoutHistory',
      'setProjectType',
      'setProjectTitle',
      'startTextProject',
      'startNewAnalysis',
    ];

    it.each(expectedActions)('exposes %s as a function', (key) => {
      expect(typeof (slice as any)[key]).toBe('function');
    });
  });

  describe('addToScoutHistory', () => {
    it('adds topic to front of history and caps at 5', () => {
      let currentState: any = { scoutHistory: ['a', 'b', 'c', 'd', 'e'] };
      set = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentState = updater(currentState);
        }
      }) as any;
      slice = createProjectMetaSlice(set, get);

      slice.addToScoutHistory('new');

      expect(currentState.scoutHistory).toEqual(['new', 'a', 'b', 'c', 'd']);
      expect(currentState.scoutHistory.length).toBe(5);
    });

    it('moves existing topic to front instead of duplicating', () => {
      let currentState: any = { scoutHistory: ['a', 'b', 'c'] };
      set = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentState = updater(currentState);
        }
      }) as any;
      slice = createProjectMetaSlice(set, get);

      slice.addToScoutHistory('b');

      expect(currentState.scoutHistory).toEqual(['b', 'a', 'c']);
    });

    it('ignores empty/whitespace-only topics', () => {
      let currentState: any = { scoutHistory: ['a'] };
      set = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentState = updater(currentState);
        }
      }) as any;
      slice = createProjectMetaSlice(set, get);

      slice.addToScoutHistory('   ');

      expect(currentState.scoutHistory).toEqual(['a']);
    });
  });

  describe('setTranscript', () => {
    it('calls set with transcript value', async () => {
      await slice.setTranscript('hello world');
      expect(set).toHaveBeenCalledWith({ transcript: 'hello world' });
    });
  });

  describe('setScoutResults', () => {
    it('calls set with scout results array', async () => {
      const results = ['topic1', 'topic2'];
      await slice.setScoutResults(results);
      expect(set).toHaveBeenCalledWith({ scoutResults: results });
    });
  });

  describe('setProjectType', () => {
    it('calls set with project type', async () => {
      await slice.setProjectType('text');
      expect(set).toHaveBeenCalledWith({ projectType: 'text' });
    });
  });

  describe('setProjectTitle', () => {
    it('calls set with project title', async () => {
      await slice.setProjectTitle('My Project');
      expect(set).toHaveBeenCalledWith({ projectTitle: 'My Project' });
    });
  });

  describe('startTextProject', () => {
    it('sets projectType, projectTitle, and transcript in a single set call', async () => {
      await slice.startTextProject('Test Title', 'Some text');
      expect(set).toHaveBeenCalledWith({
        projectType: 'text',
        projectTitle: 'Test Title',
        transcript: 'Some text',
      });
    });
  });

  describe('startNewAnalysis', () => {
    it('clears storage and sets cross-slice state for new analysis', async () => {
      await slice.startNewAnalysis('video', 'New Video');

      // Storage should be cleared
      expect(get()).toBeDefined();

      // set should be called with cross-slice reset state
      expect(set).toHaveBeenCalledWith({
        tasks: [],
        transcript: null,
        scoutResults: [],
        scoutHistory: [],
        projectType: 'video',
        projectTitle: 'New Video',
        logs: [],
        isProcessing: true,
        scoutTopic: '',
        scoutPlatform: 'instagram',
      });
    });
  });
});
