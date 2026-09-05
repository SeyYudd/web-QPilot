// lib/blob-store.ts — Blob store web-native di IndexedDB (db `qpilot-blobs`,
// store `payloads` — nama mengikuti konvensi extension). Kontrak `put(blob) →
// key` sama dengan `window.qpilotBlobStore` extension, sehingga flow Upload
// Capture identik tanpa bergantung pada service worker.

const DB_NAME = "qpilot-blobs";
const STORE_NAME = "payloads";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Gagal membuka IndexedDB."));
  });
}

export async function putBlob(blob: Blob): Promise<string> {
  const db = await openDb();
  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const key = `blob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    tx.objectStore(STORE_NAME).put(blob, key);
    tx.oncomplete = () => {
      db.close();
      resolve(key);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Gagal menyimpan blob ke IndexedDB."));
    };
  });
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => {
      db.close();
      resolve(request.result as Blob | undefined);
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error("Gagal membaca blob dari IndexedDB."));
    };
  });
}

export async function deleteBlob(key: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Gagal menghapus blob dari IndexedDB."));
    };
  });
}
