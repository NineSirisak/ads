import { describe, it, expect, vi } from 'vitest';
import { OfflineSyncQueue, type PendingAction, type StorageAdapter } from '@/lib/offlineSync/queue';

function createInMemoryStorage(): StorageAdapter & { _data: Map<string, PendingAction> } {
  const data = new Map<string, PendingAction>();
  return {
    _data: data,
    async getAll() {
      return Array.from(data.values());
    },
    async put(action: PendingAction) {
      data.set(action.idempotencyKey, action);
    },
    async remove(key: string) {
      data.delete(key);
    },
  };
}

describe('OfflineSyncQueue', () => {
  it('enqueues an action with retryCount 0', async () => {
    const storage = createInMemoryStorage();
    const queue = new OfflineSyncQueue(storage);

    await queue.enqueue({
      idempotencyKey: 'key-1',
      actionType: 'checkin',
      payload: { jobId: 'job-1' },
      createdAt: new Date().toISOString(),
    });

    expect(await queue.getPendingCount()).toBe(1);
    expect(storage._data.get('key-1')?.retryCount).toBe(0);
  });

  it('removes action from queue after successful sync', async () => {
    const storage = createInMemoryStorage();
    const queue = new OfflineSyncQueue(storage);
    await queue.enqueue({
      idempotencyKey: 'key-1',
      actionType: 'gps_ping',
      payload: {},
      createdAt: new Date().toISOString(),
    });

    const result = await queue.syncAll(async () => ({ success: true }));

    expect(result.synced).toBe(1);
    expect(await queue.getPendingCount()).toBe(0);
  });

  it('increments retryCount on failed sync but keeps the action', async () => {
    const storage = createInMemoryStorage();
    const queue = new OfflineSyncQueue(storage);
    await queue.enqueue({
      idempotencyKey: 'key-1',
      actionType: 'checkout',
      payload: {},
      createdAt: new Date().toISOString(),
    });

    const result = await queue.syncAll(async () => ({ success: false }));

    expect(result.failed).toBe(1);
    expect(await queue.getPendingCount()).toBe(1);
    expect(storage._data.get('key-1')?.retryCount).toBe(1);
  });

  it('marks action as abandoned after exceeding max retries via thrown errors', async () => {
    const storage = createInMemoryStorage();
    const queue = new OfflineSyncQueue(storage);
    await queue.enqueue({
      idempotencyKey: 'key-1',
      actionType: 'ocr_scan',
      payload: {},
      createdAt: new Date().toISOString(),
    });

    // simulate retryCount already at 2 -> next failure hits max (3)
    storage._data.set('key-1', { ...storage._data.get('key-1')!, retryCount: 2 });

    const result = await queue.syncAll(async () => {
      throw new Error('network error');
    });

    expect(result.abandoned).toBe(1);
    const stuck = await queue.getStuckActions();
    expect(stuck).toHaveLength(1);
    expect(stuck[0].idempotencyKey).toBe('key-1');
  });

  it('does not create duplicate actions when enqueueing the same idempotency key twice', async () => {
    const storage = createInMemoryStorage();
    const queue = new OfflineSyncQueue(storage);
    const action = {
      idempotencyKey: 'dup-key',
      actionType: 'checkin' as const,
      payload: { jobId: 'job-1' },
      createdAt: new Date().toISOString(),
    };

    await queue.enqueue(action);
    await queue.enqueue(action);

    expect(await queue.getPendingCount()).toBe(1);
  });

  it('syncAll processes multiple actions independently', async () => {
    const storage = createInMemoryStorage();
    const queue = new OfflineSyncQueue(storage);
    await queue.enqueue({ idempotencyKey: 'a', actionType: 'checkin', payload: {}, createdAt: '' });
    await queue.enqueue({ idempotencyKey: 'b', actionType: 'checkout', payload: {}, createdAt: '' });

    const syncFn = vi.fn(async (action: PendingAction) => ({
      success: action.idempotencyKey === 'a',
    }));

    const result = await queue.syncAll(syncFn);

    expect(result.synced).toBe(1);
    expect(result.failed).toBe(1);
    expect(syncFn).toHaveBeenCalledTimes(2);
  });
});
