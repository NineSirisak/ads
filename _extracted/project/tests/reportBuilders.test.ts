import { describe, it, expect } from 'vitest';
import { buildDailySummaryExcel } from '@/lib/reports/excel';
import { buildDailySummaryPdf } from '@/lib/reports/pdf';
import type { DailySummaryReportRow } from '@/types';

const sampleRows: DailySummaryReportRow[] = [
  { courierBrand: 'KEX', totalJobs: 120, totalNetRevenue: 45000, totalCommission: 5500, totalAdvanceDeducted: 1200 },
  { courierBrand: 'J&T', totalJobs: 90, totalNetRevenue: 32000, totalCommission: 4100, totalAdvanceDeducted: 0 },
];

describe('buildDailySummaryExcel', () => {
  it('produces a non-empty Buffer', async () => {
    const buffer = await buildDailySummaryExcel('2026-07-04', sampleRows);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('starts with the ZIP/XLSX file signature (PK)', async () => {
    const buffer = await buildDailySummaryExcel('2026-07-04', sampleRows);
    // .xlsx เป็น zip archive ภายใน — header ต้องขึ้นด้วย "PK"
    expect(buffer.subarray(0, 2).toString('ascii')).toBe('PK');
  });

  it('handles an empty rows array without throwing', async () => {
    const buffer = await buildDailySummaryExcel('2026-07-04', []);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('buildDailySummaryPdf', () => {
  it('produces a non-empty Buffer', async () => {
    const buffer = await buildDailySummaryPdf('2026-07-04', sampleRows);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('starts with the PDF file signature (%PDF)', async () => {
    const buffer = await buildDailySummaryPdf('2026-07-04', sampleRows);
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('handles an empty rows array without throwing', async () => {
    const buffer = await buildDailySummaryPdf('2026-07-04', []);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
