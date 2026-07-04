import { describe, it, expect } from 'vitest';
import {
  shouldTakeSample,
  shouldFlushBatch,
  shouldUseHighAccuracy,
  SAMPLING_INTERVAL_MS,
  BATCH_TIME_THRESHOLD_MS,
  type SamplingState,
} from '@/lib/gps/sampling';

function baseState(overrides: Partial<SamplingState> = {}): SamplingState {
  return {
    hasActiveJob: true,
    lastSampleAtMs: null,
    bufferedPingCount: 0,
    lastBatchSentAtMs: null,
    ...overrides,
  };
}

describe('shouldTakeSample', () => {
  it('does not sample when there is no active job', () => {
    const state = baseState({ hasActiveJob: false, lastSampleAtMs: null });
    expect(shouldTakeSample(state, Date.now())).toBe(false);
  });

  it('samples immediately on first call (lastSampleAtMs is null)', () => {
    const state = baseState({ lastSampleAtMs: null });
    expect(shouldTakeSample(state, Date.now())).toBe(true);
  });

  it('does not sample again before the interval has elapsed', () => {
    const now = Date.now();
    const state = baseState({ lastSampleAtMs: now - 30_000 }); // 30s ago, interval is 60s
    expect(shouldTakeSample(state, now)).toBe(false);
  });

  it('samples again once the interval has fully elapsed', () => {
    const now = Date.now();
    const state = baseState({ lastSampleAtMs: now - SAMPLING_INTERVAL_MS });
    expect(shouldTakeSample(state, now)).toBe(true);
  });
});

describe('shouldFlushBatch', () => {
  it('does not flush an empty buffer', () => {
    const state = baseState({ bufferedPingCount: 0 });
    expect(shouldFlushBatch(state, Date.now())).toBe(false);
  });

  it('flushes once buffer reaches the size threshold (3)', () => {
    const state = baseState({ bufferedPingCount: 3, lastBatchSentAtMs: Date.now() });
    expect(shouldFlushBatch(state, Date.now())).toBe(true);
  });

  it('does not flush below size threshold if time threshold not reached', () => {
    const now = Date.now();
    const state = baseState({ bufferedPingCount: 1, lastBatchSentAtMs: now });
    expect(shouldFlushBatch(state, now)).toBe(false);
  });

  it('flushes when time threshold reached even with fewer than 3 pings', () => {
    const now = Date.now();
    const state = baseState({ bufferedPingCount: 1, lastBatchSentAtMs: now - BATCH_TIME_THRESHOLD_MS });
    expect(shouldFlushBatch(state, now)).toBe(true);
  });

  it('flushes when there are buffered pings but no previous batch timestamp yet, once size threshold hit', () => {
    const state = baseState({ bufferedPingCount: 3, lastBatchSentAtMs: null });
    expect(shouldFlushBatch(state, Date.now())).toBe(true);
  });
});

describe('shouldUseHighAccuracy', () => {
  it('uses high accuracy for check-in', () => {
    expect(shouldUseHighAccuracy('checkin')).toBe(true);
  });
  it('uses high accuracy for check-out', () => {
    expect(shouldUseHighAccuracy('checkout')).toBe(true);
  });
  it('does not use high accuracy for routine tracking (battery saving)', () => {
    expect(shouldUseHighAccuracy('routine')).toBe(false);
  });
});
