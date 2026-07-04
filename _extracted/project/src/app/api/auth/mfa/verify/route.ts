import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserScopedClient } from '@/lib/supabaseClient';

const verifySchema = z.object({
  factor_id: z.string().min(1),
  code: z.string().length(6, 'โค้ด MFA ต้องมี 6 หลัก'),
});

export async function POST(request: NextRequest) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getUserScopedClient(accessToken);

  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: parsed.data.factor_id,
  });
  if (challengeError || !challengeData) {
    return NextResponse.json({ error: 'สร้าง challenge ไม่สำเร็จ', details: challengeError?.message }, { status: 500 });
  }

  const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
    factorId: parsed.data.factor_id,
    challengeId: challengeData.id,
    code: parsed.data.code,
  });

  if (verifyError || !verifyData) {
    return NextResponse.json({ error: 'โค้ด MFA ไม่ถูกต้องหรือหมดเวลา' }, { status: 401 });
  }

  return NextResponse.json({ session: verifyData });
}
