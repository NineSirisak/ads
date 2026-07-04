import { openDB, type IDBPDatabase } from 'idb';
import type { PendingAction, StorageAdapter } from '@/lib/offlineSync/queue';

const DB_NAME = 'cktonline-offline-queue';
const STORE_NAME = 'pending_actions';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * StorageAdapter implementation จริงสำหรับ browser — ใช้ IndexedDB ผ่าน `idb`
 * ตรงกับ interface ที่ออกแบบไว้ใน src/lib/offlineSync/queue.ts เพื่อให้ inject เข้า OfflineSyncQueue ได้
 */
export const indexedDbStorageAdapter: StorageAdapter = {
  async getAll(): Promise<PendingAction[]> {
    const db = await getDb();
    return db.getAll(STORE_NAME);
  },

  async put(action: PendingAction): Promise<void> {
    const db = await getDb();
    await db.put(STORE_NAME, action);
  },

  async remove(idempotencyKey: string): Promise<void> {
    const db = await getDb();
    await db.delete(STORE_NAME, idempotencyKey);
  },
};
