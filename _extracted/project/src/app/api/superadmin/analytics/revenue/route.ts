import { NextRequest, NextResponse } from 'next/server';
import { summarizeRevenueByBrand } from '@/lib/reports/analytics';
import { getUserScopedClient } from '@/lib/supabaseClient';
import type { RevenueSummaryRow } from '@/types';

export async function GET(request: NextRequest) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const range = request.nextUrl.searchParams.get('range') ?? '30d';
  const brand = request.nextUrl.searchParams.get('brand') ?? 'all';

  const days = parseInt(range.replace('d', ''), 10) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const supabase = getUserScopedClient(accessToken);
  let query = supabase.from('mv_daily_revenue_summary').select('*').gte('day', since);
  if (brand !== 'all') {
    query = query.eq('courier_brand', brand);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'ดึงข้อมูลไม่สำเร็จ', details: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as RevenueSummaryRow[];
  const summary = summarizeRevenueByBrand(rows);

  return NextResponse.json({ range, brand, rows, summary });
}
