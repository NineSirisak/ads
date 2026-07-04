/**
 * Generic sequence number generator
 * รูปแบบ: PREFIX + YYYYMMDD + 4-digit sequence
 * ใช้ pattern เดียวกับ BK/CI/CO ที่มีอยู่แล้วในระบบ เพื่อความสอดคล้อง
 *
 * หมายเหตุ: การจอง sequence ที่ปลอดภัยจาก race condition ต้องทำที่ DB layer
 * (เช่น ใช้ Postgres sequence หรือ `select ... for update`) — ฟังก์ชันนี้เป็นแค่ pure formatter
 * ส่วน `getNextSequenceForDay` เป็นตัวอย่าง contract ที่ repository layer ต้อง implement
 */

export type TicketPrefix = 'BK' | 'CI' | 'CO' | 'ADV';

export function formatTicketNumber(
  prefix: TicketPrefix,
  date: Date,
  sequence: number
): string {
  if (sequence < 1 || sequence > 9999) {
    throw new Error(
      `Sequence ต้องอยู่ระหว่าง 1-9999 เท่านั้น (ได้รับ: ${sequence})`
    );
  }

  const yyyy = date.getFullYear().toString().padStart(4, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const seq = sequence.toString().padStart(4, '0');

  return `${prefix}${yyyy}${mm}${dd}${seq}`;
}

export function parseTicketNumber(ticketNo: string): {
  prefix: string;
  date: string; // YYYYMMDD
  sequence: number;
} | null {
  const match = ticketNo.match(/^([A-Z]{2,3})(\d{8})(\d{4})$/);
  if (!match) return null;

  const [, prefix, date, seq] = match;
  return { prefix, date, sequence: parseInt(seq, 10) };
}

/**
 * Contract สำหรับ repository ที่จะไปดึง/จอง sequence ถัดไปจาก DB
 * (Implementation จริงอยู่ที่ Supabase RPC เพื่อความ atomic)
 */
export interface SequenceRepository {
  getNextSequenceForDay(prefix: TicketPrefix, date: Date): Promise<number>;
}
