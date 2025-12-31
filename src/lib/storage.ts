/**
 * Storage utilities with Private Browsing detection
 * Uses IndexedDB via idb-keyval with sessionStorage fallback
 */

import { get, set, del } from 'idb-keyval';
import type { StorageKey } from './types';

let storageAvailable: boolean | null = null;

/**
 * Check if IndexedDB is available (fails in Private Browsing mode on some browsers)
 * Caches result after first check
 */
export async function checkStorageAvailability(): Promise<boolean> {
  if (storageAvailable !== null) {
    return storageAvailable;
  }

  const testKey = '__cubit_storage_test__';
  const testValue = 'test';

  try {
    await set(testKey, testValue);
    const retrieved = await get(testKey);
    await del(testKey);
    
    storageAvailable = retrieved === testValue;
    return storageAvailable;
  } catch (error) {
    console.warn('[Storage] IndexedDB unavailable (possibly Private Browsing):', error);
    storageAvailable = false;
    return false;
  }
}

/**
 * Save data to storage with automatic fallback
 * Uses IndexedDB if available, otherwise sessionStorage (RAM)
 */
export async function saveToStorage<T>(key: StorageKey, value: T): Promise<void> {
  const isAvailable = await checkStorageAvailability();

  if (isAvailable) {
    try {
      await set(key, value);
      return;
    } catch (error) {
      console.error('[Storage] IndexedDB write failed:', error);
    }
  }

  // Fallback to sessionStorage (RAM-only, cleared on tab close)
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    console.warn('[Storage] Using sessionStorage fallback - data will not persist after tab close');
  } catch (error) {
    console.error('[Storage] sessionStorage write failed:', error);
    throw new Error('Unable to save data: all storage methods failed');
  }
}

/**
 * Load data from storage with automatic fallback
 */
export async function loadFromStorage<T>(key: StorageKey): Promise<T | null> {
  const isAvailable = await checkStorageAvailability();

  if (isAvailable) {
    try {
      const value = await get<T>(key);
      return value ?? null;
    } catch (error) {
      console.error('[Storage] IndexedDB read failed:', error);
    }
  }

  // Fallback to sessionStorage
  try {
    const item = sessionStorage.getItem(key);
    if (item) {
      return JSON.parse(item) as T;
    }
  } catch (error) {
    console.error('[Storage] sessionStorage read failed:', error);
  }

  return null;
}

/**
 * Remove data from storage
 */
export async function removeFromStorage(key: StorageKey): Promise<void> {
  const isAvailable = await checkStorageAvailability();

  if (isAvailable) {
    try {
      await del(key);
    } catch (error) {
      console.error('[Storage] IndexedDB delete failed:', error);
    }
  }

  // Also clear from sessionStorage in case of fallback
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    // Ignore sessionStorage errors on delete
  }
}

/**
 * Get current storage mode for UI display
 */
export async function getStorageMode(): Promise<'indexeddb' | 'session' | 'none'> {
  const isAvailable = await checkStorageAvailability();
  
  if (isAvailable) {
    return 'indexeddb';
  }

  // Check if sessionStorage is available
  try {
    sessionStorage.setItem('__test__', '1');
    sessionStorage.removeItem('__test__');
    return 'session';
  } catch {
    return 'none';
  }
}
