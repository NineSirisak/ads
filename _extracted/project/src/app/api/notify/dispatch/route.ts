import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pushLineMessageWithRetry } from '@/lib/notifications/line';
import { getServiceRoleClient } from '@/lib/supabaseClient';

/**
 * Internal-only endpoint — เรียกจาก DB trigger / cron / Edge Function เท่านั้น
 * ต้องตรวจสอบ internal secret header เพราะ endpoint นี้ใช้ service role (bypass RLS)
 */

const dispatchSchema = z.object({
  channel: z.enum(['line', 'email', 'web_push']),
  target: z.string().min(1),
  payload: z.record(z.unknown()),
});

export async function POST(request: NextRequest) {
  const internalSecret = request.headers.get('x-internal-secret');
  if (internalSecret !== process.env.INTERNAL_DISPATCH_SECRET) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต (internal endpoint)' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = dispatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceRoleClient();
  const { channel, target, payload } = parsed.data;

  const { data: logEntry, error: insertError } = await supabase
    .from('notification_log')
    .insert({ channel, target, payload, status: 'queued' })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'บันทึก log ไม่สำเร็จ', details: insertError.message }, { status: 500 });
  }

  if (channel === 'line') {
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!lineToken) {
      return NextResponse.json({ error: 'ไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN' }, { status: 500 });
    }

    const result = await pushLineMessageWithRetry({
      channelAccessToken: lineToken,
      to: target,
      text: String(payload.text ?? ''),
    });

    await supabase
      .from('notification_log')
      .update({
        status: result.success ? 'sent' : 'failed',
        error: result.lastError ?? null,
        sent_at: result.success ? new Date().toISOString() : null,
      })
      .eq('id', logEntry.id);

    return NextResponse.json({ status: result.success ? 'sent' : 'failed', attempts: result.attempts });
  }

  // email / web_push: ยัง queued ไว้ก่อน — worker แยกจะมา process ต่อ (ดู notification_design.md)
  return NextResponse.json({ status: 'queued' });
}
