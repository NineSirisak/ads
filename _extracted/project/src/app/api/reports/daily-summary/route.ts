import { NextRequest, NextResponse } from 'next/server';
import { buildDailySummaryExcel } from '@/lib/reports/excel';
import { buildDailySummaryPdf } from '@/lib/reports/pdf';
import { getUserScopedClient } from '@/lib/supabaseClient';
import type { DailySummaryReportRow, ReportFormat } from '@/types';

export async function GET(request: NextRequest) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get('date');
  const format = (request.nextUrl.searchParams.get('format') ?? 'csv') as ReportFormat;

  if (!date) {
    return NextResponse.json({ error: 'ต้องระบุ query param: date (YYYY-MM-DD)' }, { status: 400 });
  }
  if (!['pdf', 'xlsx', 'csv'].includes(format)) {
    return NextResponse.json({ error: 'format ต้องเป็น pdf, xlsx หรือ csv เท่านั้น' }, { status: 400 });
  }

  const supabase = getUserScopedClient(accessToken);

  // ดึงจาก materialized view ที่ aggregate ไว้แล้ว (ดู 01_architecture/superadmin_analytics_design.md)
  const { data, error } = await supabase
    .from('mv_daily_revenue_summary')
    .select('*')
    .eq('day', date);

  if (error) {
    return NextResponse.json({ error: 'ดึงข้อมูลรายงานไม่สำเร็จ', details: error.message }, { status: 500 });
  }

  const rows: DailySummaryReportRow[] = (data ?? []).map((r: any) => ({
    courierBrand: r.courier_brand,
    totalJobs: r.total_jobs,
    totalNetRevenue: r.total_net_revenue,
    totalCommission: r.total_commission ?? 0,
    totalAdvanceDeducted: r.total_advance_deducted ?? 0,
  }));

  if (format === 'xlsx') {
    const buffer = await buildDailySummaryExcel(date, rows);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="daily-summary-${date}.xlsx"`,
      },
    });
  }

  if (format === 'csv') {
    const csv = buildCsv(rows);
    // UTF-8 BOM เพื่อให้ Excel เปิดภาษาไทยถูกต้อง (ตามที่ระบบเดิมทำอยู่แล้ว)
    const bom = '\uFEFF';
    return new NextResponse(bom + csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="daily-summary-${date}.csv"`,
      },
    });
  }

  // format === 'pdf'
  const pdfBuffer = await buildDailySummaryPdf(date, rows);
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="daily-summary-${date}.pdf"`,
    },
  });
}

function buildCsv(rows: DailySummaryReportRow[]): string {
  const header = 'บริษัทขนส่ง,จำนวนงาน,รายได้สุทธิ,ค่าคอมมิชชั่น,หักเงินสำรอง';
  const lines = rows.map(
    (r) =>
      `${r.courierBrand},${r.totalJobs},${r.totalNetRevenue},${r.totalCommission},${r.totalAdvanceDeducted}`
  );
  return [header, ...lines].join('\n');
}
