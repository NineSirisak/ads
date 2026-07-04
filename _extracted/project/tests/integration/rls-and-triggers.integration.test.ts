import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * ⚠️ หมายเหตุสำคัญ — อ่านก่อนรัน
 *
 * Test ไฟล์นี้ต้องรันกับ Supabase ที่มีจริง (local หรือ staging) เท่านั้น
 * ไม่สามารถรันได้ใน sandbox ของ Claude เพราะที่นี่ไม่มี Supabase project/credentials เชื่อมต่อจริง
 * (ไม่มี Docker/Supabase CLI ในสภาพแวดล้อมนี้ด้วย)
 *
 * วิธีรันจริงในเครื่องของคุณ:
 *   1. supabase start                     (เปิด Supabase local)
 *   2. supabase db push                   (รัน migration ทั้ง 3 ไฟล์ใน supabase/migrations)
 *   3. ตั้ง env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY ให้ชี้ไปที่ local instance
 *   4. ลบ `.skip` ด้านล่างออก แล้วรัน: npx vitest run tests/integration
 *
 * สิ่งที่ integration test ชุดนี้ต้อง cover เพิ่มจาก unit test (ที่ทำไปแล้ว 101 tests เป็น pure logic):
 *   - RLS policy จริง: driver เห็นเฉพาะ advance_requests ของตัวเอง, เห็น audit_logs ไม่ได้ถ้าไม่ใช่ SuperAdmin
 *   - Trigger จริง: insert ลง cod_transactions นอกเวลางาน -> ต้องมี row ใน activity_logs + notification_log
 *   - RPC จริง: next_ticket_sequence ต้อง atomic ภายใต้ concurrent request (race condition)
 *   - Materialized view refresh จริง
 */
describe.skip('Integration: RLS policies (ต้องรันกับ Supabase local จริง)', () => {
  let supabaseAsDriver!: ReturnType<typeof createClient>;
  let supabaseAsAdmin!: ReturnType<typeof createClient>;

  beforeAll(() => {
    // TODO: sign in ด้วย test user จริงที่ seed ไว้ล่วงหน้า แล้วสร้าง client ด้วย access_token ของแต่ละ role
    throw new Error('ยังไม่ได้ตั้งค่า Supabase local สำหรับ integration test — ดูคำแนะนำด้านบนของไฟล์นี้');
  });

  it('driver เห็นเฉพาะ advance_requests ของตัวเอง', async () => {
    const { data } = await supabaseAsDriver.from('advance_requests').select('*');
    const rows = (data ?? []) as Array<{ driver_id: string }>;
    expect(rows.every((row) => row.driver_id === 'test-driver-id')).toBe(true);
  });

  it('driver เข้าถึง audit_logs ไม่ได้เลย (ไม่มี policy select ให้)', async () => {
    const { data, error } = await supabaseAsDriver.from('audit_logs').select('*');
    expect(data).toEqual([]); // RLS จะ filter ออกหมด ไม่ error แต่ได้ array เปล่า
  });

  it('SuperAdmin เห็น audit_logs ได้', async () => {
    const { data } = await supabaseAsAdmin.from('audit_logs').select('*');
    expect(Array.isArray(data)).toBe(true);
  });
});

describe.skip('Integration: after-hours trigger (ต้องรันกับ Supabase local จริง)', () => {
  it('insert cod_transaction หลัง 20:00 -> สร้าง activity_log และ notification_log อัตโนมัติ', async () => {
    // TODO: mock เวลาระบบเป็น 21:00 Bangkok หรือรัน test ช่วงเวลานั้นจริง แล้ว insert แถวทดสอบ
    // จากนั้น query activity_logs ว่ามี event_type = 'after_hours_activity' เกิดขึ้นไหม
    expect(true).toBe(true); // placeholder
  });
});

describe.skip('Integration: ticket sequence race condition (ต้องรันกับ Supabase local จริง)', () => {
  it('ยิง next_ticket_sequence 20 ครั้งพร้อมกัน ต้องได้เลขไม่ซ้ำกันเลย', async () => {
    // TODO: Promise.all ยิง RPC พร้อมกัน 20 ครั้ง แล้วเช็คว่าผลลัพธ์เป็น 1-20 ไม่มีเลขซ้ำ
    expect(true).toBe(true); // placeholder
  });
});
