const DB_NAME = 'vow-cache-v1';
const STORE_NAME = 'records';
const DB_VERSION = 1;

type CacheRecord<T> = {
  key: string;
  userId: string;
  savedAt: number;
  value: T;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local cache.'));
  });
}

export async function readCache<T>(key: string, userId: string): Promise<{ value: T; savedAt: number } | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => {
        const record = request.result as CacheRecord<T> | undefined;
        if (!record || record.userId !== userId) {
          resolve(null);
          return;
        }
        resolve({ value: record.value, savedAt: record.savedAt });
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, userId: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
        key,
        userId,
        savedAt: Date.now(),
        value,
      } satisfies CacheRecord<T>);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Cache failure must never break the online application.
  }
}

export async function clearUserCache(userId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result as IDBCursorWithValue | null;
        if (!cursor) return;
        const record = cursor.value as CacheRecord<unknown>;
        if (record.userId === userId) cursor.delete();
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Ignore cache cleanup failures.
  }
}

export function cacheIsFresh(savedAt: number, maxAgeMs: number): boolean {
  return Date.now() - savedAt <= maxAgeMs;
}
