/**
 * Offline Sync Queue — client-side logic (ใช้ร่วมกับ IndexedDB ผ่าน `idb`)
 * เขียนเป็น pure logic ที่ inject storage adapter เข้ามา เพื่อ unit test ได้โดยไม่ต้องมี browser
 */

export interface PendingAction {
  idempotencyKey: string; // uuid สร้างตอนกดปุ่มครั้งแรก กันการสร้างซ้ำเวลา retry
  actionType: 'checkin' | 'checkout' | 'ocr_scan' | 'gps_ping';
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

export interface StorageAdapter {
  getAll(): Promise<PendingAction[]>;
  put(action: PendingAction): Promise<void>;
  remove(idempotencyKey: string): Promise<void>;
}

const MAX_RETRY_COUNT = 3;

export class OfflineSyncQueue {
  constructor(private readonly storage: StorageAdapter) {}

  async enqueue(action: Omit<PendingAction, 'retryCount'>): Promise<void> {
    await this.storage.put({ ...action, retryCount: 0 });
  }

  async getPendingCount(): Promise<number> {
    const all = await this.storage.getAll();
    return all.length;
  }

  /**
   * ประมวลผล queue ทั้งหมด — ใช้ syncFn ที่ inject เข้ามา (คือการยิง API จริง)
   * เพื่อให้ทดสอบได้โดยไม่ต้องพึ่ง network จริง
   */
  async syncAll(
    syncFn: (action: PendingAction) => Promise<{ success: boolean }>
  ): Promise<{ synced: number; failed: number; abandoned: number }> {
    const pending = await this.storage.getAll();
    let synced = 0;
    let failed = 0;
    let abandoned = 0;

    for (const action of pending) {
      try {
        const result = await syncFn(action);
        if (result.success) {
          await this.storage.remove(action.idempotencyKey);
          synced++;
        } else {
          await this.handleFailedAttempt(action);
          failed++;
        }
      } catch {
        const updated = await this.handleFailedAttempt(action);
        if (updated.retryCount >= MAX_RETRY_COUNT) {
          abandoned++;
        } else {
          failed++;
        }
      }
    }

    return { synced, failed, abandoned };
  }

  private async handleFailedAttempt(action: PendingAction): Promise<PendingAction> {
    const updated: PendingAction = { ...action, retryCount: action.retryCount + 1 };

    if (updated.retryCount >= MAX_RETRY_COUNT) {
      // เกิน retry ที่กำหนด — คงไว้ใน queue แต่ต้อง flag ให้ UI แจ้ง admin ตรวจสอบ
      // (ไม่ auto-remove เพราะข้อมูลอาจสำคัญ เช่น check-in ที่ยังไม่ sync)
      await this.storage.put(updated);
      return updated;
    }

    await this.storage.put(updated);
    return updated;
  }

  async getStuckActions(): Promise<PendingAction[]> {
    const all = await this.storage.getAll();
    return all.filter((a) => a.retryCount >= MAX_RETRY_COUNT);
  }
}
