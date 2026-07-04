import { NextRequest, NextResponse } from 'next/server';
import { getUserScopedClient } from '@/lib/supabaseClient';

export async function GET(request: NextRequest, { params }: { params: { job_id: string } }) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const supabase = getUserScopedClient(accessToken);
  const { data, error } = await supabase
    .from('gps_pings')
    .select('lat, lng, captured_at')
    .eq('job_id', params.job_id)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'ไม่พบตำแหน่งล่าสุดสำหรับงานนี้' }, { status: 404 });
  }

  return NextResponse.json(data);
}
