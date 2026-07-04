import { NextRequest, NextResponse } from 'next/server';
import { createAdvanceRequestSchema } from '@/lib/advanceRequests';
import { formatTicketNumber } from '@/lib/ticketNumber';
import { getUserScopedClient } from '@/lib/supabaseClient';

/**
 * POST /api/advance-requests   -> driver สร้างคำขอเบิกเงินสำรอง
 * GET  /api/advance-requests?status=pending -> admin ดูรายการ
 */

export async function POST(request: NextRequest) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต (missing token)' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createAdvanceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'ข้อมูลไม่ถูกต้อง', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = getUserScopedClient(accessToken);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'ไม่พบ session ผู้ใช้' }, { status: 401 });
  }

  // จอง sequence แบบ atomic ผ่าน RPC (implement เป็น Postgres function แยก)
  const { data: seqData, error: seqError } = await supabase.rpc('next_ticket_sequence', {
    p_prefix: 'ADV',
    p_date: new Date().toISOString().slice(0, 10),
  });

  if (seqError) {
    return NextResponse.json(
      { error: 'ไม่สามารถออกเลขคำขอได้ กรุณาลองใหม่', details: seqError.message },
      { status: 500 }
    );
  }

  const requestNo = formatTicketNumber('ADV', new Date(), seqData as number);

  const { data, error } = await supabase
    .from('advance_requests')
    .insert({
      request_no: requestNo,
      driver_id: userData.user.id,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'บันทึกคำขอไม่สำเร็จ', details: error.message }, { status: 500 });
  }

  // สร้าง approval record คู่กันทันที (polymorphic entity) — ขาดขั้นตอนนี้แล้ว Frontend
  // จะไม่มี approval_id ให้เรียก /api/approvals/:id/decide ได้เลย (root cause ของบั๊กที่พบระหว่างสร้าง UI)
  const { data: approval, error: approvalError } = await supabase
    .from('approvals')
    .insert({
      entity_type: 'advance_request',
      entity_id: data.id,
      requested_by: userData.user.id,
      decision: 'pending',
    })
    .select()
    .single();

  if (approvalError) {
    // ถ้าสร้าง approval ไม่สำเร็จ ต้อง rollback คำขอเดิม ไม่ให้มีคำขอที่ "อนุมัติไม่ได้" ค้างอยู่ในระบบ
    await supabase.from('advance_requests').delete().eq('id', data.id);
    return NextResponse.json(
      { error: 'สร้างคำขอไม่สมบูรณ์ กรุณาลองใหม่', details: approvalError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { request_no: data.request_no, status: data.status, approval_id: approval.id },
    { status: 201 }
  );
}

export async function GET(request: NextRequest) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต (missing token)' }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get('status');
  const supabase = getUserScopedClient(accessToken);

  // join กับ approvals ผ่าน entity_id เพื่อให้ Frontend ได้ approval_id ไปใช้เรียก
  // /api/approvals/:id/decide โดยตรง (ดู root cause note ใน POST handler ด้านบน)
  let query = supabase
    .from('advance_requests')
    .select('*, approvals!inner(id)')
    .eq('approvals.entity_type', 'advance_request')
    .order('requested_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'ดึงข้อมูลไม่สำเร็จ', details: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row: any) => {
    const { approvals, ...rest } = row;
    return { ...rest, approval_id: approvals?.[0]?.id ?? approvals?.id ?? null };
  });

  return NextResponse.json(rows);
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}
