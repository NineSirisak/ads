import { NextRequest, NextResponse } from 'next/server';
import { gpsBatchSchema, sanityCheckPings } from '@/lib/gps/batch';
import { getUserScopedClient } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = gpsBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'ข้อมูล GPS ไม่ถูกต้อง', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { valid, rejected } = sanityCheckPings(parsed.data.pings);

  if (valid.length === 0) {
    return NextResponse.json(
      { error: 'ไม่มี ping ที่ผ่านการตรวจสอบ', rejected },
      { status: 400 }
    );
  }

  const supabase = getUserScopedClient(accessToken);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'ไม่พบ session ผู้ใช้' }, { status: 401 });
  }

  const rows = valid.map((ping) => ({
    driver_id: userData.user.id,
    job_id: ping.job_id ?? null,
    lat: ping.lat,
    lng: ping.lng,
    accuracy_m: ping.accuracy_m ?? null,
    captured_at: ping.captured_at,
    synced_offline: ping.synced_offline ?? false,
  }));

  const { error: insertError } = await supabase.from('gps_pings').insert(rows);
  if (insertError) {
    return NextResponse.json({ error: 'บันทึก GPS ไม่สำเร็จ', details: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: rows.length, rejected: rejected.length });
}
