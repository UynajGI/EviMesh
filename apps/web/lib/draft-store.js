const DB_NAME = 'evimesh-drafts';
const STORE_NAME = 'forms';
const DB_VERSION = 1;

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDraftDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open draft storage.'));
  });
}

export async function loadDraft(key, fallback) {
  if (!canUseIndexedDb()) return fallback;
  let database;
  try {
    database = await openDraftDatabase();
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result ?? fallback);
      request.onerror = () => reject(request.error ?? new Error('Unable to read draft.'));
    });
  } catch {
    return fallback;
  } finally {
    database?.close();
  }
}

export async function saveDraft(key, value) {
  if (!canUseIndexedDb()) return false;
  let database;
  try {
    database = await openDraftDatabase();
    await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error ?? new Error('Unable to save draft.'));
    });
    return true;
  } catch {
    return false;
  } finally {
    database?.close();
  }
}

export async function removeDraft(key) {
  if (!canUseIndexedDb()) return false;
  let database;
  try {
    database = await openDraftDatabase();
    await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error ?? new Error('Unable to remove draft.'));
    });
    return true;
  } catch {
    return false;
  } finally {
    database?.close();
  }
}
