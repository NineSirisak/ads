import { NextRequest, NextResponse } from 'next/server';
import { calculateFraudRateTrend, type FraudRatePoint } from '@/lib/reports/analytics';
import { getUserScopedClient } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const range = request.nextUrl.searchParams.get('range') ?? '90d';
  const months = Math.max(1, Math.round((parseInt(range.replace('d', ''), 10) || 90) / 30));

  const supabase = getUserScopedClient(accessToken);
  const { data, error } = await supabase.rpc('get_fraud_rate_by_month', { p_months: months });

  if (error) {
    return NextResponse.json({ error: 'ดึงข้อมูลไม่สำเร็จ', details: error.message }, { status: 500 });
  }

  const points = (data ?? []) as FraudRatePoint[];
  const trend = calculateFraudRateTrend(points);

  return NextResponse.json({ range, trend });
}
