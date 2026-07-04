import type { Approval, ApprovalDecision } from '@/types';

/**
 * Approval decision — generic logic ที่ reuse ได้ทั้ง cod_transaction และ advance_request
 */

export class ApprovalAlreadyDecidedError extends Error {
  constructor(currentDecision: ApprovalDecision) {
    super(`คำขอนี้ถูกตัดสินใจไปแล้ว (สถานะปัจจุบัน: ${currentDecision}) ไม่สามารถตัดสินซ้ำได้`);
    this.name = 'ApprovalAlreadyDecidedError';
  }
}

export function decideApproval(
  approval: Approval,
  decision: 'approved' | 'rejected',
  reviewerId: string,
  reason?: string
): Approval {
  if (approval.decision !== 'pending') {
    throw new ApprovalAlreadyDecidedError(approval.decision);
  }

  return {
    ...approval,
    decision,
    decision_reason: reason ?? null,
    reviewed_by: reviewerId,
    decided_at: new Date().toISOString(),
  };
}

/**
 * ตรวจว่าผู้ตัดสินใจ (reviewer) ไม่ใช่คนเดียวกับผู้ขอ (requester)
 * ป้องกัน conflict of interest — คนขอเบิกเงินไม่ควรอนุมัติเองได้ แม้จะมี role สูงพอ
 */
export function assertNoSelfApproval(approval: Approval, reviewerId: string): void {
  if (approval.requested_by && approval.requested_by === reviewerId) {
    throw new Error('ผู้ขออนุมัติไม่สามารถอนุมัติคำขอของตัวเองได้');
  }
}
