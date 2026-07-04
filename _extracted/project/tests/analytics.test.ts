import { describe, it, expect } from 'vitest';
import { calculateFraudRatePercent, calculateFraudRateTrend, summarizeRevenueByBrand } from '@/lib/reports/analytics';
import type { RevenueSummaryRow } from '@/types';

describe('calculateFraudRatePercent', () => {
  it('returns 0 when there is no data', () => {
    const result = calculateFraudRatePercent({
      month: '2026-07',
      verifiedCount: 0,
      flaggedFraudCount: 0,
      pendingReviewCount: 0,
    });
    expect(result).toBe(0);
  });

  it('calculates percentage correctly', () => {
    const result = calculateFraudRatePercent({
      month: '2026-07',
      verifiedCount: 80,
      flaggedFraudCount: 15,
      pendingReviewCount: 5,
    });
    expect(result).toBe(15);
  });
});

describe('calculateFraudRateTrend', () => {
  it('sorts points chronologically regardless of input order', () => {
    const trend = calculateFraudRateTrend([
      { month: '2026-07', verifiedCount: 90, flaggedFraudCount: 10, pendingReviewCount: 0 },
      { month: '2026-05', verifiedCount: 95, flaggedFraudCount: 5, pendingReviewCount: 0 },
      { month: '2026-06', verifiedCount: 92, flaggedFraudCount: 8, pendingReviewCount: 0 },
    ]);
    expect(trend.map((t) => t.month)).toEqual(['2026-05', '2026-06', '2026-07']);
  });

  it('computes fraud rate for each point', () => {
    const trend = calculateFraudRateTrend([
      { month: '2026-07', verifiedCount: 90, flaggedFraudCount: 10, pendingReviewCount: 0 },
    ]);
    expect(trend[0].fraudRatePercent).toBe(10);
  });
});

describe('summarizeRevenueByBrand', () => {
  it('aggregates multiple days into brand totals', () => {
    const rows: RevenueSummaryRow[] = [
      { day: '2026-07-01', courier_brand: 'KEX', total_net_revenue: 1000, total_jobs: 10 },
      { day: '2026-07-02', courier_brand: 'KEX', total_net_revenue: 500, total_jobs: 5 },
      { day: '2026-07-01', courier_brand: 'J&T', total_net_revenue: 800, total_jobs: 8 },
    ];

    const summary = summarizeRevenueByBrand(rows);

    expect(summary.KEX).toEqual({ totalNetRevenue: 1500, totalJobs: 15 });
    expect(summary['J&T']).toEqual({ totalNetRevenue: 800, totalJobs: 8 });
  });

  it('returns empty object for empty input', () => {
    expect(summarizeRevenueByBrand([])).toEqual({});
  });
});
