import { NextRequest, NextResponse } from 'next/server';
import { decideApprovalSchema } from '@/lib/advanceRequests';
import { decideApproval, assertNoSelfApproval, ApprovalAlreadyDecidedError } from '@/lib/approvals';
import { getUserScopedClient } from '@/lib/supabaseClient';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = decideApprovalSchema.safeParse(body);
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

  const { data: approval, error: fetchError } = await supabase
    .from('approvals')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !approval) {
    return NextResponse.json({ error: 'ไม่พบคำขออนุมัตินี้' }, { status: 404 });
  }

  try {
    assertNoSelfApproval(approval, userData.user.id);
    const updated = decideApproval(approval, parsed.data.decision, userData.user.id, parsed.data.reason);

    const { error: updateError } = await supabase
      .from('approvals')
      .update({
        decision: updated.decision,
        decision_reason: updated.decision_reason,
        reviewed_by: updated.reviewed_by,
        decided_at: updated.decided_at,
      })
      .eq('id', params.id);

    if (updateError) {
      return NextResponse.json({ error: 'อัปเดตไม่สำเร็จ', details: updateError.message }, { status: 500 });
    }

    // audit trail — บันทึกทุกการอนุมัติ/ปฏิเสธ (การเงิน/สิทธิ์ = ต้อง traceable)
    await supabase.from('audit_logs').insert({
      actor_id: userData.user.id,
      action: `${updated.decision}_${approval.entity_type}`,
      entity_type: approval.entity_type,
      entity_id: approval.entity_id,
      after_data: { decision: updated.decision, reason: updated.decision_reason },
    });

    return NextResponse.json({ decision: updated.decision, decided_at: updated.decided_at });
  } catch (err) {
    if (err instanceof ApprovalAlreadyDecidedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
