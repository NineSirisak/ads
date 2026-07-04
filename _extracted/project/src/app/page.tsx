export const dynamic = 'force-static';

export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 880,
        margin: '48px auto',
        padding: '32px',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,.06)',
      }}
    >
      <h1 style={{ marginTop: 0 }}>CKTONLINE ✅ Deployed</h1>
      <p>
        แพ็กเกจ Gap Closure ทำงานอยู่บน Vercel เรียบร้อยแล้ว หน้านี้เป็นเพียง
        landing เพื่อยืนยันว่า build ผ่าน — โค้ดจริงทั้งหมดคือ{' '}
        <strong>API routes</strong> และ <strong>React components</strong> ใต้{' '}
        <code>src/</code> ซึ่งจะถูกฝังเข้ากับหน้า Admin/Driver ของโปรเจกต์
        CKTONLINE เดิม
      </p>

      <h2>สิ่งที่พร้อมใช้งาน</h2>
      <ul>
        <li>10 API endpoint ครบ (MFA, GPS, Reports, Analytics, Approvals ฯลฯ)</li>
        <li>Vercel Cron: daily summary (01:00) + notification dispatch (ทุก 5 นาที)</li>
        <li>React components: MFA / Advance Requests / Analytics / Offline indicator</li>
        <li>Supabase migrations พร้อมรันด้วย <code>supabase db push</code></li>
      </ul>

      <h2>Health check</h2>
      <p>
        <a href="/api/health">/api/health</a> — ควรตอบ{' '}
        <code>{'{ ok: true }'}</code>
      </p>

      <p style={{ marginTop: 32, fontSize: 13, color: '#697180' }}>
        Build:{' '}
        <code>
          {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'}
        </code>{' '}
        · Region: <code>{process.env.VERCEL_REGION ?? 'local'}</code>
      </p>
    </main>
  );
}
