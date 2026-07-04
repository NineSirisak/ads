import type { RevenueSummaryRow } from '@/types';

/**
 * Pure aggregation helpers สำหรับ SuperAdmin Analytics
 * (การ query จริงมาจาก materialized view — ฟังก์ชันนี้ทำ post-processing/derived metrics)
 */

export interface FraudRatePoint {
  month: string; // YYYY-MM
  verifiedCount: number;
  flaggedFraudCount: number;
  pendingReviewCount: number;
}

export function calculateFraudRatePercent(point: FraudRatePoint): number {
  const total = point.verifiedCount + point.flaggedFraudCount + point.pendingReviewCount;
  if (total === 0) return 0;
  return round2((point.flaggedFraudCount / total) * 100);
}

export function calculateFraudRateTrend(points: FraudRatePoint[]): Array<{
  month: string;
  fraudRatePercent: number;
}> {
  return points
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((p) => ({ month: p.month, fraudRatePercent: calculateFraudRatePercent(p) }));
}

export function summarizeRevenueByBrand(
  rows: RevenueSummaryRow[]
): Record<string, { totalNetRevenue: number; totalJobs: number }> {
  const result: Record<string, { totalNetRevenue: number; totalJobs: number }> = {};

  for (const row of rows) {
    if (!result[row.courier_brand]) {
      result[row.courier_brand] = { totalNetRevenue: 0, totalJobs: 0 };
    }
    result[row.courier_brand].totalNetRevenue = round2(
      result[row.courier_brand].totalNetRevenue + row.total_net_revenue
    );
    result[row.courier_brand].totalJobs += row.total_jobs;
  }

  return result;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
