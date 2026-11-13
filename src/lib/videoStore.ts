/**
 * Uploaded exercise videos are kept in the browser's IndexedDB (files are too
 * big for localStorage). This is the only storage until a cloud backend is
 * connected; swap these three functions for cloud storage calls then.
 */

const DB_NAME = 'pure-function';
const STORE = 'exercise-videos';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function saveVideoFile(key: string, file: Blob): Promise<void> {
  await run('readwrite', (s) => s.put(file, key));
}

export async function loadVideoFile(key: string): Promise<Blob | null> {
  try {
    const blob = await run<Blob | undefined>('readonly', (s) => s.get(key));
    return blob ?? null;
  } catch {
    return null;
  }
}

export async function deleteVideoFile(key: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(key));
  } catch {
    /* nothing to delete */
  }
}
