/**
 * GPS Sampling decision logic — แยกเป็น pure function เพื่อ unit test ได้
 * โดยไม่ต้องพึ่ง Geolocation API ของ browser
 *
 * กติกา (ตาม docs/01_design_docs/10_gps_tracking/gps_tracking_design.md):
 * - Sample เฉพาะตอนมีงาน active เท่านั้น
 * - Interval ปกติ 60 วินาที
 * - Batch ส่งขึ้น server ทุก 3 ping หรือทุก 3 นาที (แล้วแต่ถึงก่อน)
 */

export interface SamplingState {
  hasActiveJob: boolean;
  lastSampleAtMs: number | null;
  bufferedPingCount: number;
  lastBatchSentAtMs: number | null;
}

export const SAMPLING_INTERVAL_MS = 60_000; // 60 วินาที
export const BATCH_SIZE_THRESHOLD = 3;
export const BATCH_TIME_THRESHOLD_MS = 3 * 60_000; // 3 นาที

export function shouldTakeSample(state: SamplingState, nowMs: number): boolean {
  if (!state.hasActiveJob) return false;
  if (state.lastSampleAtMs === null) return true;
  return nowMs - state.lastSampleAtMs >= SAMPLING_INTERVAL_MS;
}

export function shouldFlushBatch(state: SamplingState, nowMs: number): boolean {
  if (state.bufferedPingCount === 0) return false;
  if (state.bufferedPingCount >= BATCH_SIZE_THRESHOLD) return true;
  if (state.lastBatchSentAtMs === null) return false;
  return nowMs - state.lastBatchSentAtMs >= BATCH_TIME_THRESHOLD_MS;
}

/**
 * ตัดสินใจว่าควรใช้ enableHighAccuracy หรือไม่
 * ใช้ high accuracy เฉพาะตอน check-in/check-out เพื่อประหยัดแบตในสถานะปกติ
 */
export function shouldUseHighAccuracy(context: 'checkin' | 'checkout' | 'routine'): boolean {
  return context === 'checkin' || context === 'checkout';
}
