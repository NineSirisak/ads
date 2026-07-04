import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserScopedClient } from '@/lib/supabaseClient';

const sendReportSchema = z.object({
  to: z.string().email('อีเมลไม่ถูกต้อง'),
  report_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = sendReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getUserScopedClient(accessToken);

  // enqueue เข้า notification_log แบบ channel='email' — worker แยกไปส่งจริงผ่าน Resend/SMTP
  const { error } = await supabase.from('notification_log').insert({
    channel: 'email',
    target: parsed.data.to,
    payload: { report_id: parsed.data.report_id },
    status: 'queued',
  });

  if (error) {
    return NextResponse.json({ error: 'คิวส่งอีเมลไม่สำเร็จ', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'queued' });
}
