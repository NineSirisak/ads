import { NextRequest, NextResponse } from 'next/server';
import { getUserScopedClient } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const supabase = getUserScopedClient(accessToken);

  // ใช้ Supabase Auth MFA แทนการทำ TOTP เอง ลด attack surface
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });

  if (error || !data) {
    return NextResponse.json({ error: 'เริ่มตั้งค่า MFA ไม่สำเร็จ', details: error?.message }, { status: 500 });
  }

  return NextResponse.json({
    qr_code: data.totp.qr_code,
    secret: data.totp.secret,
    factor_id: data.id,
  });
}
