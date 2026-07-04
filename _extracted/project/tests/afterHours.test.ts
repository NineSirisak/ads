import { describe, it, expect } from 'vitest';
import { toBangkokHour, isAfterHours, evaluateAfterHoursSeverity, buildAlertMessage } from '@/lib/notifications/afterHours';

describe('toBangkokHour', () => {
  it('converts UTC midnight to 7am Bangkok', () => {
    expect(toBangkokHour('2026-07-04T00:00:00Z')).toBe(7);
  });

  it('wraps around midnight correctly (UTC 18:00 -> Bangkok 01:00 next day)', () => {
    expect(toBangkokHour('2026-07-04T18:00:00Z')).toBe(1);
  });

  it('throws on invalid date string', () => {
    expect(() => toBangkokHour('not-a-date')).toThrow();
  });
});

describe('isAfterHours', () => {
  it('flags 21:00 Bangkok time as after-hours', () => {
    // 21:00 Bangkok = 14:00 UTC
    expect(isAfterHours('2026-07-04T14:00:00Z')).toBe(true);
  });

  it('flags 03:00 Bangkok time as after-hours', () => {
    // 03:00 Bangkok = 20:00 UTC previous day
    expect(isAfterHours('2026-07-03T20:00:00Z')).toBe(true);
  });

  it('does not flag 14:00 Bangkok time (working hours)', () => {
    // 14:00 Bangkok = 07:00 UTC
    expect(isAfterHours('2026-07-04T07:00:00Z')).toBe(false);
  });

  it('boundary: exactly 20:00 Bangkok is after-hours (inclusive)', () => {
    // 20:00 Bangkok = 13:00 UTC
    expect(isAfterHours('2026-07-04T13:00:00Z')).toBe(true);
  });

  it('boundary: exactly 06:00 Bangkok is NOT after-hours (exclusive end)', () => {
    // 06:00 Bangkok = 23:00 UTC previous day
    expect(isAfterHours('2026-07-03T23:00:00Z')).toBe(false);
  });
});

describe('evaluateAfterHoursSeverity', () => {
  it('returns null when actor is system/service role (no false positives on cron)', () => {
    const result = evaluateAfterHoursSeverity({
      tableName: 'cod_transactions',
      rowId: 'r1',
      actorId: null,
      occurredAtUtc: '2026-07-04T14:00:00Z',
      amount: 100000,
    });
    expect(result).toBeNull();
  });

  it('returns null when event happens during working hours', () => {
    const result = evaluateAfterHoursSeverity({
      tableName: 'cod_transactions',
      rowId: 'r1',
      actorId: 'user-1',
      occurredAtUtc: '2026-07-04T07:00:00Z', // 14:00 Bangkok
      amount: 100000,
    });
    expect(result).toBeNull();
  });

  it('returns info for low-amount after-hours activity', () => {
    const result = evaluateAfterHoursSeverity({
      tableName: 'cod_transactions',
      rowId: 'r1',
      actorId: 'user-1',
      occurredAtUtc: '2026-07-04T14:00:00Z',
      amount: 100,
    });
    expect(result).toBe('info');
  });

  it('returns warning above warning threshold', () => {
    const result = evaluateAfterHoursSeverity({
      tableName: 'cod_transactions',
      rowId: 'r1',
      actorId: 'user-1',
      occurredAtUtc: '2026-07-04T14:00:00Z',
      amount: 6000,
    });
    expect(result).toBe('warning');
  });

  it('returns critical above critical threshold', () => {
    const result = evaluateAfterHoursSeverity({
      tableName: 'advance_requests',
      rowId: 'r2',
      actorId: 'user-2',
      occurredAtUtc: '2026-07-04T14:00:00Z',
      amount: 25000,
    });
    expect(result).toBe('critical');
  });
});

describe('buildAlertMessage', () => {
  it('includes table name and row id in the message', () => {
    const message = buildAlertMessage(
      { tableName: 'cod_transactions', rowId: 'abc-123', actorId: 'u1', occurredAtUtc: '2026-07-04T14:00:00Z' },
      'critical'
    );
    expect(message).toContain('cod_transactions');
    expect(message).toContain('abc-123');
    expect(message).toContain('🚨');
  });
});
