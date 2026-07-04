import { NextRequest, NextResponse } from 'next/server';
import { getUserScopedClient } from '@/lib/supabaseClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { driver_id: string } }
) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const supabase = getUserScopedClient(accessToken);

  const { data, error } = await supabase
    .from('advance_requests')
    .select('amount')
    .eq('driver_id', params.driver_id)
    .eq('status', 'disbursed'); // disbursed แต่ยังไม่ settled = ค้างอยู่

  if (error) {
    return NextResponse.json({ error: 'ดึงข้อมูลไม่สำเร็จ', details: error.message }, { status: 500 });
  }

  const outstanding = data.reduce((sum, row) => sum + Number(row.amount), 0);

  return NextResponse.json({ outstanding_amount: Math.round(outstanding * 100) / 100 });
}
