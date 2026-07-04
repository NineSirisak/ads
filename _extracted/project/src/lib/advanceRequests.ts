import { z } from 'zod';
import type { SettlementResult } from '@/types';

/**
 * Advance Requests — เบิกจ่ายเงินสำรองคนขับ
 * แยกทิศทางเงินจาก COD โดยเด็ดขาด (ดู 06_financial/financial_workflow_design.md)
 */

export const createAdvanceRequestSchema = z.object({
  amount: z
    .number()
    .positive('จำนวนเงินต้องมากกว่า 0')
    .max(50000, 'จำนวนเงินเบิกล่วงหน้าต้องไม่เกิน 50,000 บาทต่อครั้ง'),
  reason: z
    .string()
    .trim()
    .min(5, 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร')
    .max(500, 'เหตุผลยาวเกินไป (สูงสุด 500 ตัวอักษร)'),
});

export type CreateAdvanceRequestInput = z.infer<typeof createAdvanceRequestSchema>;

export const decideApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(500).optional(),
});

export type DecideApprovalInput = z.infer<typeof decideApprovalSchema>;

/**
 * คำนวณยอดหักคืนอัตโนมัติจาก net revenue ของคนขับ
 * กติกา:
 * - หักได้ไม่เกิน net revenue ของรอบนั้น (ห้ามทำให้คนขับติดลบ)
 * - หักตามยอดค้าง (outstanding) ที่ disbursed แล้วแต่ยัง settled ไม่ครบ
 */
export function applyAdvanceSettlement(
  netRevenue: number,
  outstandingAdvance: number
): SettlementResult {
  if (netRevenue < 0) {
    throw new Error('net revenue ต้องไม่ติดลบ ก่อนเข้าสู่ขั้นตอนหักเงินสำรอง');
  }
  if (outstandingAdvance < 0) {
    throw new Error('ยอดเงินสำรองค้างชำระต้องไม่ติดลบ');
  }

  const advanceDeducted = Math.min(netRevenue, outstandingAdvance);
  const netRevenueAfterAdvance = round2(netRevenue - advanceDeducted);
  const remainingOutstanding = round2(outstandingAdvance - advanceDeducted);

  return {
    netRevenueAfterAdvance,
    advanceDeducted: round2(advanceDeducted),
    remainingOutstanding,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * State machine guard: ตรวจสอบว่า transition ของ status ถูกต้องตามลำดับหรือไม่
 * ป้องกันการ skip step (เช่น pending -> settled โดยไม่ผ่าน approved/disbursed)
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['approved', 'rejected'],
  approved: ['disbursed'],
  disbursed: ['settled'],
  rejected: [],
  settled: [],
};

export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
