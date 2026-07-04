import type { AfterHoursActivityEvent, FraudAlertSeverity } from '@/types';

/**
 * ระบบเฝ้าระวังทุจริตนอกเวลางาน (สเปคจุดที่ 5.2)
 * ช่วงเวลาเสี่ยง: 20:00 - 06:00 น. เวลาไทย (Asia/Bangkok, UTC+7)
 *
 * ออกแบบให้เป็น pure function รับ "เวลา UTC" แล้วแปลงเองภายใน
 * เพื่อไม่ต้องพึ่ง library ภายนอกสำหรับ timezone ใน unit test (ลด dependency ในการทดสอบ)
 */

const BANGKOK_UTC_OFFSET_HOURS = 7;
const AFTER_HOURS_START = 20; // 20:00
const AFTER_HOURS_END = 6; // 06:00 (exclusive)

export function toBangkokHour(utcIso: string): number {
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`วันเวลาไม่ถูกต้อง: ${utcIso}`);
  }
  const bangkokHour = (date.getUTCHours() + BANGKOK_UTC_OFFSET_HOURS) % 24;
  return bangkokHour;
}

export function isAfterHours(utcIso: string): boolean {
  const hour = toBangkokHour(utcIso);
  return hour >= AFTER_HOURS_START || hour < AFTER_HOURS_END;
}

/**
 * ตัดสิน severity ของ event นอกเวลางาน
 * - actorId === null -> เป็น system/service role -> ไม่ flag เลย (false positive control)
 * - amount สูงกว่า threshold -> warning/critical
 */
export function evaluateAfterHoursSeverity(
  event: AfterHoursActivityEvent,
  thresholds: { warningAmount: number; criticalAmount: number } = {
    warningAmount: 5000,
    criticalAmount: 20000,
  }
): FraudAlertSeverity | null {
  if (event.actorId === null) {
    // เกิดจาก cron/service role เอง ไม่ใช่การกระทำของมนุษย์ที่น่าสงสัย
    return null;
  }

  if (!isAfterHours(event.occurredAtUtc)) {
    return null;
  }

  const amount = event.amount ?? 0;
  if (amount >= thresholds.criticalAmount) return 'critical';
  if (amount >= thresholds.warningAmount) return 'warning';
  return 'info';
}

export function buildAlertMessage(
  event: AfterHoursActivityEvent,
  severity: FraudAlertSeverity
): string {
  const severityLabel: Record<FraudAlertSeverity, string> = {
    info: 'แจ้งเตือน',
    warning: '⚠️ คำเตือน',
    critical: '🚨 วิกฤต',
  };

  return `${severityLabel[severity]}: พบการอัปเดตข้อมูลนอกเวลางาน ในตาราง "${event.tableName}" (แถว ${event.rowId})`;
}
