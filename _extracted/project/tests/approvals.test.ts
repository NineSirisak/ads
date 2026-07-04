import { describe, it, expect } from 'vitest';
import { decideApproval, assertNoSelfApproval, ApprovalAlreadyDecidedError } from '@/lib/approvals';
import type { Approval } from '@/types';

function baseApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: 'appr-1',
    entity_type: 'advance_request',
    entity_id: 'adv-1',
    requested_by: 'driver-1',
    reviewed_by: null,
    decision: 'pending',
    decision_reason: null,
    created_at: new Date().toISOString(),
    decided_at: null,
    ...overrides,
  };
}

describe('decideApproval', () => {
  it('approves a pending request', () => {
    const approval = baseApproval();
    const result = decideApproval(approval, 'approved', 'admin-1', 'ตรวจสอบแล้วถูกต้อง');

    expect(result.decision).toBe('approved');
    expect(result.reviewed_by).toBe('admin-1');
    expect(result.decision_reason).toBe('ตรวจสอบแล้วถูกต้อง');
    expect(result.decided_at).not.toBeNull();
  });

  it('rejects a pending request with a reason', () => {
    const approval = baseApproval();
    const result = decideApproval(approval, 'rejected', 'admin-1', 'เอกสารไม่ครบ');
    expect(result.decision).toBe('rejected');
  });

  it('throws ApprovalAlreadyDecidedError when re-deciding an approved request', () => {
    const approval = baseApproval({ decision: 'approved' });
    expect(() => decideApproval(approval, 'rejected', 'admin-1')).toThrow(ApprovalAlreadyDecidedError);
  });

  it('throws when re-deciding a rejected request', () => {
    const approval = baseApproval({ decision: 'rejected' });
    expect(() => decideApproval(approval, 'approved', 'admin-1')).toThrow(ApprovalAlreadyDecidedError);
  });
});

describe('assertNoSelfApproval', () => {
  it('throws when reviewer is the same as requester', () => {
    const approval = baseApproval({ requested_by: 'user-1' });
    expect(() => assertNoSelfApproval(approval, 'user-1')).toThrow();
  });

  it('does not throw when reviewer differs from requester', () => {
    const approval = baseApproval({ requested_by: 'driver-1' });
    expect(() => assertNoSelfApproval(approval, 'admin-1')).not.toThrow();
  });

  it('does not throw when requested_by is null (system-generated approval)', () => {
    const approval = baseApproval({ requested_by: null });
    expect(() => assertNoSelfApproval(approval, 'admin-1')).not.toThrow();
  });
});
