import { NextRequest, NextResponse } from 'next/server';
import { getUserScopedClient } from '@/lib/supabaseClient';

const SIGNED_URL_TTL_SECONDS = 300; // 5 นาที

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const supabase = getUserScopedClient(accessToken);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'ไม่พบ session ผู้ใช้' }, { status: 401 });
  }

  const { data: fileRecord, error: fileError } = await supabase
    .from('files')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fileError || !fileRecord) {
    return NextResponse.json({ error: 'ไม่พบไฟล์นี้' }, { status: 404 });
  }

  // RLS ที่ DB จะบล็อกอยู่แล้วถ้าไม่มีสิทธิ์ แต่เช็คซ้ำที่ application layer เพื่อ error message ที่ชัดเจนกว่า
  const { data: signedUrlData, error: signError } = await supabase.storage
    .from(fileRecord.bucket)
    .createSignedUrl(fileRecord.object_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signedUrlData) {
    return NextResponse.json({ error: 'สร้าง signed URL ไม่สำเร็จ', details: signError?.message }, { status: 500 });
  }

  // log การเข้าถึงไฟล์เพื่อ traceability
  await supabase.from('activity_logs').insert({
    actor_id: userData.user.id,
    event_type: 'file_signed_url_requested',
    message: `ขอ signed URL สำหรับไฟล์ ${params.id}`,
    metadata: { file_id: params.id },
  });

  return NextResponse.json({
    url: signedUrlData.signedUrl,
    expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  });
}
