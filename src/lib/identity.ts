const DEVICE_ID_KEY = 'cubit_device_id';
const DEVICE_LABEL_KEY = 'cubit_device_label';
const UNO_WORKSPACE_ID_KEY = 'cubit_uno_workspace_id';

export type WorkspaceType = 'personalUno' | 'personalMulti' | 'teamWorkspace';

/**
 * Persistent per-browser identity. Generated once via crypto.randomUUID()
 * and stored in localStorage forever. Survives IndexedDB clears.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr-placeholder';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * User-editable device label (e.g. "James's MacBook").
 * Falls back to a generated name on first visit.
 */
export function getDeviceLabel(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(DEVICE_LABEL_KEY) || '';
}

export function setDeviceLabel(label: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEVICE_LABEL_KEY, label);
}

/**
 * The personalUno workspace ID isolates uno projects in their own
 * IndexedDB namespace. Generated once per browser profile.
 */
export function getUnoWorkspaceId(): string {
  if (typeof window === 'undefined') return 'ssr-placeholder';
  let id = localStorage.getItem(UNO_WORKSPACE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(UNO_WORKSPACE_ID_KEY, id);
  }
  return id;
}

/**
 * Build the IndexedDB key for a given workspace.
 */
export function getStorageKey(workspaceType: WorkspaceType, workspaceId: string): string {
  switch (workspaceType) {
    case 'personalUno':
      return `cubit_uno_${workspaceId}`;
    case 'personalMulti':
      return `cubit_multi_${workspaceId}`;
    case 'teamWorkspace':
      return `cubit_team_${workspaceId}`;
  }
}
