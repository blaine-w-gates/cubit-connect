/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * UI Slice — UI-only state that is NOT persisted to Yjs or localStorage.
 *
 * Includes: settings modal, sync modal, processing state, input mode,
 * scout topic/platform, active mode, processing row, last added row,
 * selected step, peer editing, active processing ID.
 */

export interface UISliceState {
  // Input mode & Scout
  inputMode: 'video' | 'text' | 'scout';
  setInputMode: (mode: 'video' | 'text' | 'scout') => void;
  scoutTopic: string;
  setScoutTopic: (topic: string) => void;
  scoutPlatform: string;
  setScoutPlatform: (platform: string) => void;

  // Processing UI
  activeProcessingId: string | null;
  setActiveProcessingId: (id: string | null) => void;

  // Collaboration locking
  peerIsEditing: boolean;
  setPeerIsEditing: (isEditing: boolean) => void;

  // Sync force update
  _syncToggle: boolean;
  forceSyncUpdate: () => void;

  // Settings modal
  isSettingsOpen: boolean;
  settingsVariant: 'default' | 'quota';
  setIsSettingsOpen: (isOpen: boolean, variant?: 'default' | 'quota') => void;

  // Sync modal
  isSyncModalOpen: boolean;
  setIsSyncModalOpen: (isOpen: boolean) => void;

  // Video handle
  hasVideoHandle: boolean;
  setVideoHandleState: (hasHandle: boolean) => void;

  // Processing state
  isProcessing: boolean;
  setProcessing: (isProcessing: boolean) => void;

  // Todo UI state (not persisted)
  activeMode: 'cubit' | 'deepDive' | 'dialLeft' | 'dialRight' | null;
  setActiveMode: (mode: 'cubit' | 'deepDive' | 'dialLeft' | 'dialRight' | null) => void;
  processingRowId: string | null;
  setProcessingRowId: (rowId: string | null) => void;
  lastAddedRowId: string | null;
  setLastAddedRowId: (rowId: string | null) => void;

  // Alarm UI state
  selectedStepId: { projectId: string; rowId: string; stepIndex: number } | null;
  selectStep: (projectId: string, rowId: string, stepIndex: number) => void;
  clearSelectedStep: () => void;
}

export function createUISlice(
  set: (partial: any) => void,
  _get: () => any
): UISliceState {
  return {
    // Input mode & Scout
    inputMode: 'video',
    setInputMode: (mode) => set({ inputMode: mode }),
    scoutTopic: '',
    setScoutTopic: (topic) => set({ scoutTopic: topic }),
    scoutPlatform: 'instagram',
    setScoutPlatform: (platform) => set({ scoutPlatform: platform }),

    // Processing UI
    activeProcessingId: null,
    setActiveProcessingId: (id) => set({ activeProcessingId: id }),

    // Collaboration locking
    peerIsEditing: false,
    setPeerIsEditing: (isEditing) => set({ peerIsEditing: isEditing }),

    // Sync force update
    _syncToggle: false,
    forceSyncUpdate: () => set((s: any) => ({ _syncToggle: !s._syncToggle })),

    // Settings modal
    isSettingsOpen: false,
    settingsVariant: 'default' as const,
    setIsSettingsOpen: (isOpen, variant = 'default' as const) =>
      set({ isSettingsOpen: isOpen, settingsVariant: variant }),

    // Sync modal
    isSyncModalOpen: false,
    setIsSyncModalOpen: (isOpen) => set({ isSyncModalOpen: isOpen }),

    // Video handle
    hasVideoHandle: false,
    setVideoHandleState: (hasHandle) => set({ hasVideoHandle: hasHandle }),

    // Processing state
    isProcessing: false,
    setProcessing: (isProcessing) => set({ isProcessing }),

    // Todo UI state
    activeMode: null,
    setActiveMode: (mode) => set({ activeMode: mode }),
    processingRowId: null,
    setProcessingRowId: (rowId) => set({ processingRowId: rowId }),
    lastAddedRowId: null,
    setLastAddedRowId: (rowId) => set({ lastAddedRowId: rowId }),

    // Alarm UI state
    selectedStepId: null,
    selectStep: (projectId, rowId, stepIndex) =>
      set({ selectedStepId: { projectId, rowId, stepIndex } }),
    clearSelectedStep: () => set({ selectedStepId: null }),
  };
}
