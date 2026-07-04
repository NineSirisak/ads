import { z } from 'zod';
import type { GpsPing } from '@/types';

/**
 * GPS batch ingestion — validation + sanity checks
 * ป้องกันข้อมูลเพี้ยน (lat/lng ผิดช่วง, timestamp ในอนาคต, accuracy แย่เกินไป)
 */

export const gpsPingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().nonnegative().max(10000).optional(),
  captured_at: z.string().datetime(),
  job_id: z.string().uuid().optional(),
  synced_offline: z.boolean().optional(),
});

export const gpsBatchSchema = z.object({
  pings: z.array(gpsPingSchema).min(1).max(50), // batch ทุก 3 ping ตาม design, 50 คือ safety cap
});

export interface GpsSanityCheckResult {
  valid: GpsPing[];
  rejected: Array<{ ping: GpsPing; reason: string }>;
}

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000; // อนุญาต clock skew 5 นาที
const POOR_ACCURACY_THRESHOLD_M = 500; // แม่นยำแย่กว่านี้ = อาจไม่ควรใช้ยืนยันตำแหน่งจริง

export function sanityCheckPings(pings: GpsPing[]): GpsSanityCheckResult {
  const now = Date.now();
  const valid: GpsPing[] = [];
  const rejected: Array<{ ping: GpsPing; reason: string }> = [];

  for (const ping of pings) {
    const capturedTime = new Date(ping.captured_at).getTime();

    if (Number.isNaN(capturedTime)) {
      rejected.push({ ping, reason: 'captured_at ไม่ใช่วันเวลาที่ถูกต้อง' });
      continue;
    }

    if (capturedTime - now > MAX_FUTURE_SKEW_MS) {
      rejected.push({ ping, reason: 'captured_at อยู่ในอนาคตเกินกว่าที่ยอมรับได้' });
      continue;
    }

    if (ping.lat === 0 && ping.lng === 0) {
      // (0,0) มักหมายถึง GPS ยังไม่ fix สัญญาณ ไม่ใช่ตำแหน่งจริง
      rejected.push({ ping, reason: 'พิกัด (0,0) น่าจะเป็นค่า default ของอุปกรณ์ ไม่ใช่ตำแหน่งจริง' });
      continue;
    }

    valid.push(ping);
  }

  return { valid, rejected };
}

export function isLowAccuracy(ping: GpsPing): boolean {
  return (ping.accuracy_m ?? 0) > POOR_ACCURACY_THRESHOLD_M;
}

/**
 * ตรวจว่าระยะห่างระหว่าง 2 จุด (กม.) สมเหตุสมผลไหมภายในเวลาที่ผ่านไป
 * ใช้ตรวจ anti-fraud: ถ้าคนขับ "เทเลพอร์ต" ในเวลาสั้นๆ น่าสงสัย
 * ใช้ Haversine formula แบบง่าย
 */
export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function isImplausibleJump(
  previous: GpsPing,
  current: GpsPing,
  maxSpeedKmh = 160 // เผื่อทางด่วน/มอเตอร์เวย์
): boolean {
  const distanceKm = haversineDistanceKm(previous, current);
  const hoursElapsed =
    (new Date(current.captured_at).getTime() - new Date(previous.captured_at).getTime()) /
    3_600_000;

  if (hoursElapsed <= 0) return false;
  const impliedSpeed = distanceKm / hoursElapsed;
  return impliedSpeed > maxSpeedKmh;
}
