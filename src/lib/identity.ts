const DEVICE_ID_KEY = 'cubit_device_id';
const DEVICE_LABEL_KEY = 'cubit_device_label';
const UNO_WORKSPACE_ID_KEY = 'cubit_uno_workspace_id';

import { getNamespacedStorageKey } from './yjsClientId';

export type WorkspaceType = 'personalUno' | 'personalMulti' | 'teamWorkspace';

/**
 * Persistent per-browser identity. Generated once via crypto.randomUUID()
 * and stored in localStorage forever. Survives IndexedDB clears.
 * In test environments, uses session-isolated keys to prevent cross-tab collisions.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr-placeholder';
  const namespacedKey = getNamespacedStorageKey(DEVICE_ID_KEY);
  let id = localStorage.getItem(namespacedKey);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(namespacedKey, id);
  }
  return id;
}

/**
 * User-editable device label (e.g. "James's MacBook").
 * Falls back to a generated name on first visit.
 */
export function getDeviceLabel(): string {
  if (typeof window === 'undefined') return '';
  const namespacedKey = getNamespacedStorageKey(DEVICE_LABEL_KEY);
  return localStorage.getItem(namespacedKey) || '';
}

export function setDeviceLabel(label: string): void {
  if (typeof window === 'undefined') return;
  const namespacedKey = getNamespacedStorageKey(DEVICE_LABEL_KEY);
  localStorage.setItem(namespacedKey, label);
}

/**
 * The personalUno workspace ID isolates uno projects in their own
 * IndexedDB namespace. Generated once per browser profile.
 * In test environments, uses session-isolated keys to prevent cross-tab collisions.
 */
export function getUnoWorkspaceId(): string {
  if (typeof window === 'undefined') return 'ssr-placeholder';
  const namespacedKey = getNamespacedStorageKey(UNO_WORKSPACE_ID_KEY);
  let id = localStorage.getItem(namespacedKey);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(namespacedKey, id);
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
