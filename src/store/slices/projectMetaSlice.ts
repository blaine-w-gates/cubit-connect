/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Project Meta Slice — Project metadata, transcript, scout, and analysis actions.
 *
 * Includes: setTranscript, setScoutResults, addToScoutHistory, setProjectType,
 * setProjectTitle, startTextProject, startNewAnalysis.
 *
 * Does NOT include resetProject, exportAndClearData, fullLogout — these are
 * tightly coupled to registerYjsObserver and remain in useAppStore.ts.
 *
 * Extracted from useAppStore.ts as part of store decomposition (#25).
 */

import { storageService } from '@/services/storage';
import { yjsContext } from '@/lib/yjsContext';
import { applyUpdateToYText } from '@/lib/yjsHelpers';

export interface ProjectMetaSliceState {
  // State
  transcript: string | null;
  scoutResults: string[];
  scoutHistory: string[];
  projectType: 'video' | 'text' | 'scout';
  projectTitle: string;

  // Actions
  setTranscript: (text: string) => Promise<void>;
  setScoutResults: (results: string[]) => Promise<void>;
  addToScoutHistory: (topic: string) => void;
  setProjectType: (type: 'video' | 'text' | 'scout') => Promise<void>;
  setProjectTitle: (title: string) => Promise<void>;
  startTextProject: (title: string, text: string) => Promise<void>;
  startNewAnalysis: (type: 'video' | 'text', title: string) => Promise<void>;
}

export function createProjectMetaSlice(
  set: (partial: any) => void,
  get: () => any
): ProjectMetaSliceState {
  return {
    // --- State ---
    transcript: null,
    scoutResults: [],
    scoutHistory: [],
    projectType: 'video',
    projectTitle: 'New Project',

    // --- Actions ---
    addToScoutHistory: (topic: string) =>
      set((state: any) => {
        const current = state.scoutHistory;
        if (!topic.trim()) return state;
        const filtered = current.filter((t: string) => t !== topic);
        const updated = [topic, ...filtered].slice(0, 5);
        yjsContext.ydoc.transact(() => { yjsContext.yMetaMap.set('scoutHistory', JSON.stringify(updated)); }, 'local');
        return { scoutHistory: updated };
      }),

    setTranscript: async (text: string) => {
      yjsContext.ydoc.transact(() => { applyUpdateToYText(yjsContext.yTranscript, text || ''); }, 'local');
      set({ transcript: text });
    },

    setScoutResults: async (results: string[]) => {
      yjsContext.ydoc.transact(() => { yjsContext.yMetaMap.set('scoutResults', JSON.stringify(results)); }, 'local');
      set({ scoutResults: results });
    },

    setProjectType: async (type: 'video' | 'text' | 'scout') => {
      yjsContext.ydoc.transact(() => { yjsContext.yMetaMap.set('projectType', type); }, 'local');
      set({ projectType: type });
    },

    setProjectTitle: async (title: string) => {
      yjsContext.ydoc.transact(() => { yjsContext.yMetaMap.set('projectTitle', title); }, 'local');
      set({ projectTitle: title });
    },

    // Atomic Action for Text Mode Initialization
    startTextProject: async (title: string, text: string) => {
      const type = 'text';
      yjsContext.ydoc.transact(() => {
        yjsContext.yMetaMap.set('projectType', type);
        yjsContext.yMetaMap.set('projectTitle', title);
        applyUpdateToYText(yjsContext.yTranscript, text || '');
      }, 'local');
      set({
        projectType: type,
        projectTitle: title,
        transcript: text,
      });
    },

    // ⚡️ GLITCH-FREE RESET: For "Start Analysis" workflow
    // CROSS-SLICE COUPLING: This set() call writes to multiple slices' state:
    //   - TaskSliceState: tasks
    //   - ProjectMetaSliceState: transcript, scoutResults, scoutHistory, projectType, projectTitle
    //   - LogSliceState: logs
    //   - UISliceState: isProcessing, scoutTopic, scoutPlatform
    // This is intentional — a single batched set() ensures atomic UI updates.
    // If slice field names change, this call must be updated manually (set is typed as any).
    startNewAnalysis: async (type: 'video' | 'text', title: string) => {
      const { activeWorkspaceType, activeWorkspaceId } = get();
      await storageService.clearProject(activeWorkspaceType, activeWorkspaceId);

      // The Ghost Data Teardown:
      yjsContext.ydoc.transact(() => {
        yjsContext.yMetaMap.clear();
        yjsContext.yTranscript.delete(0, yjsContext.yTranscript.length);

        // Tombstone all active tasks and projects to prevent Zombie Resurrection
        Array.from(yjsContext.yTasksMap.values()).forEach(t => t.set('isDeleted', true));
        Array.from(yjsContext.yProjectsMap.values()).forEach(p => p.set('isDeleted', true));
      });

      set({
        tasks: [],
        transcript: null,
        scoutResults: [],
        scoutHistory: [],
        // Keep existing handle/key/processing/inputMode
        projectType: type,
        projectTitle: title,
        logs: [],
        isProcessing: true, // FORCE True (Prevent Manifesto Flash)
        // Strike 17.5: Do we clear Scout on new analysis? Probably yes.
        scoutTopic: '',
        scoutPlatform: 'instagram',
      });
    },
  };
}
