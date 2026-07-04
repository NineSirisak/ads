import { NextRequest, NextResponse } from 'next/server';

/**
 * เริ่ม flow ผูก LINE account ของผู้ใช้ (LINE Login OAuth)
 * Redirect ผู้ใช้ไปหน้า LINE consent แล้ว callback จะบันทึก line_user_id ลง notification_channels
 */
export async function POST(request: NextRequest) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
  const redirectUri = process.env.LINE_LOGIN_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า LINE Login channel' }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const redirectUrl =
    `https://access.line.me/oauth2/v2.1/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}&scope=profile%20openid`;

  return NextResponse.json({ redirect_url: redirectUrl, state });
}
