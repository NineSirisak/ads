import { describe, it, expect } from 'vitest';
import {
  gpsBatchSchema,
  sanityCheckPings,
  isLowAccuracy,
  haversineDistanceKm,
  isImplausibleJump,
} from '@/lib/gps/batch';

describe('gpsBatchSchema', () => {
  it('accepts a valid batch', () => {
    const result = gpsBatchSchema.safeParse({
      pings: [{ lat: 13.7563, lng: 100.5018, captured_at: '2026-07-04T10:00:00.000Z' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects out-of-range latitude', () => {
    const result = gpsBatchSchema.safeParse({
      pings: [{ lat: 200, lng: 100.5018, captured_at: '2026-07-04T10:00:00.000Z' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty batch', () => {
    const result = gpsBatchSchema.safeParse({ pings: [] });
    expect(result.success).toBe(false);
  });

  it('rejects batch larger than 50 pings', () => {
    const pings = Array.from({ length: 51 }, () => ({
      lat: 13.7563,
      lng: 100.5018,
      captured_at: '2026-07-04T10:00:00.000Z',
    }));
    const result = gpsBatchSchema.safeParse({ pings });
    expect(result.success).toBe(false);
  });
});

describe('sanityCheckPings', () => {
  it('rejects (0,0) coordinates as GPS-not-fixed', () => {
    const { valid, rejected } = sanityCheckPings([
      { lat: 0, lng: 0, captured_at: new Date().toISOString() },
    ]);
    expect(valid).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it('rejects pings with timestamps far in the future', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { valid, rejected } = sanityCheckPings([{ lat: 13.75, lng: 100.5, captured_at: future }]);
    expect(valid).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it('accepts a normal, current-time ping', () => {
    const { valid, rejected } = sanityCheckPings([
      { lat: 13.7563, lng: 100.5018, captured_at: new Date().toISOString() },
    ]);
    expect(valid).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('allows small clock skew (within 5 minutes)', () => {
    const nearFuture = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const { valid } = sanityCheckPings([{ lat: 13.75, lng: 100.5, captured_at: nearFuture }]);
    expect(valid).toHaveLength(1);
  });
});

describe('isLowAccuracy', () => {
  it('flags accuracy worse than 500m', () => {
    expect(isLowAccuracy({ lat: 0, lng: 0, captured_at: '', accuracy_m: 600 })).toBe(true);
  });
  it('does not flag good accuracy', () => {
    expect(isLowAccuracy({ lat: 0, lng: 0, captured_at: '', accuracy_m: 10 })).toBe(false);
  });
  it('treats missing accuracy as acceptable (0)', () => {
    expect(isLowAccuracy({ lat: 0, lng: 0, captured_at: '' })).toBe(false);
  });
});

describe('haversineDistanceKm', () => {
  it('returns ~0 for identical points', () => {
    const point = { lat: 13.7563, lng: 100.5018 };
    expect(haversineDistanceKm(point, point)).toBeCloseTo(0, 3);
  });

  it('calculates approximate distance between Bangkok and Chiang Mai (~580km)', () => {
    const bangkok = { lat: 13.7563, lng: 100.5018 };
    const chiangMai = { lat: 18.7883, lng: 98.9853 };
    const distance = haversineDistanceKm(bangkok, chiangMai);
    expect(distance).toBeGreaterThan(550);
    expect(distance).toBeLessThan(620);
  });
});

describe('isImplausibleJump', () => {
  it('flags a jump that implies faster-than-possible travel', () => {
    const previous = { lat: 13.7563, lng: 100.5018, captured_at: '2026-07-04T10:00:00.000Z' };
    const current = { lat: 18.7883, lng: 98.9853, captured_at: '2026-07-04T10:05:00.000Z' }; // 580km in 5 min
    expect(isImplausibleJump(previous, current)).toBe(true);
  });

  it('does not flag reasonable travel speed', () => {
    const previous = { lat: 13.7563, lng: 100.5018, captured_at: '2026-07-04T10:00:00.000Z' };
    const current = { lat: 13.76, lng: 100.51, captured_at: '2026-07-04T10:05:00.000Z' }; // short hop
    expect(isImplausibleJump(previous, current)).toBe(false);
  });

  it('does not flag when time has not advanced (avoid divide-by-zero issues)', () => {
    const previous = { lat: 13.7563, lng: 100.5018, captured_at: '2026-07-04T10:00:00.000Z' };
    const current = { lat: 18.7883, lng: 98.9853, captured_at: '2026-07-04T10:00:00.000Z' };
    expect(isImplausibleJump(previous, current)).toBe(false);
  });
});
