import { describe, it, expect } from 'vitest';
import {
  applyAdvanceSettlement,
  canTransition,
  createAdvanceRequestSchema,
} from '@/lib/advanceRequests';

describe('applyAdvanceSettlement', () => {
  it('deducts full outstanding amount when net revenue is sufficient', () => {
    const result = applyAdvanceSettlement(1000, 300);
    expect(result).toEqual({
      netRevenueAfterAdvance: 700,
      advanceDeducted: 300,
      remainingOutstanding: 0,
    });
  });

  it('caps deduction at net revenue when outstanding is larger (never goes negative)', () => {
    const result = applyAdvanceSettlement(200, 500);
    expect(result.netRevenueAfterAdvance).toBe(0);
    expect(result.advanceDeducted).toBe(200);
    expect(result.remainingOutstanding).toBe(300);
  });

  it('handles zero outstanding gracefully', () => {
    const result = applyAdvanceSettlement(1000, 0);
    expect(result.advanceDeducted).toBe(0);
    expect(result.netRevenueAfterAdvance).toBe(1000);
  });

  it('rounds to 2 decimal places', () => {
    const result = applyAdvanceSettlement(100.005, 50.004);
    expect(result.advanceDeducted).toBe(50);
    expect(result.netRevenueAfterAdvance).toBeCloseTo(50, 2);
  });

  it('throws on negative net revenue', () => {
    expect(() => applyAdvanceSettlement(-10, 100)).toThrow();
  });

  it('throws on negative outstanding advance', () => {
    expect(() => applyAdvanceSettlement(100, -10)).toThrow();
  });
});

describe('canTransition (state machine guard)', () => {
  it('allows pending -> approved', () => {
    expect(canTransition('pending', 'approved')).toBe(true);
  });

  it('allows pending -> rejected', () => {
    expect(canTransition('pending', 'rejected')).toBe(true);
  });

  it('allows approved -> disbursed', () => {
    expect(canTransition('approved', 'disbursed')).toBe(true);
  });

  it('allows disbursed -> settled', () => {
    expect(canTransition('disbursed', 'settled')).toBe(true);
  });

  it('rejects skipping steps: pending -> settled', () => {
    expect(canTransition('pending', 'settled')).toBe(false);
  });

  it('rejects skipping steps: pending -> disbursed', () => {
    expect(canTransition('pending', 'disbursed')).toBe(false);
  });

  it('rejects transitions from terminal states', () => {
    expect(canTransition('rejected', 'approved')).toBe(false);
    expect(canTransition('settled', 'pending')).toBe(false);
  });
});

describe('createAdvanceRequestSchema', () => {
  it('accepts a valid request', () => {
    const result = createAdvanceRequestSchema.safeParse({
      amount: 1500,
      reason: 'ค่าน้ำมันฉุกเฉินระหว่างส่งงาน',
    });
    expect(result.success).toBe(true);
  });

  it('rejects amount <= 0', () => {
    const result = createAdvanceRequestSchema.safeParse({ amount: 0, reason: 'ทดสอบ ทดสอบ' });
    expect(result.success).toBe(false);
  });

  it('rejects amount exceeding 50,000', () => {
    const result = createAdvanceRequestSchema.safeParse({ amount: 60000, reason: 'ทดสอบ ทดสอบ' });
    expect(result.success).toBe(false);
  });

  it('rejects reason shorter than 5 characters', () => {
    const result = createAdvanceRequestSchema.safeParse({ amount: 100, reason: 'สั้น' });
    expect(result.success).toBe(false);
  });
});
