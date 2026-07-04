import { NextResponse } from 'next/server';

/**
 * Health-check endpoint สำหรับ Vercel / uptime monitor
 * ไม่แตะ Supabase เพื่อให้ตอบเร็วและไม่กิน quota
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'cktonline-gap-closure',
    time: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    region: process.env.VERCEL_REGION ?? 'local',
  });
}
