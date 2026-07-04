import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * สร้าง Supabase client สำหรับใช้ฝั่ง server (API routes)
 * - getServiceRoleClient: bypass RLS ใช้เฉพาะ background job / cron / trigger dispatch เท่านั้น
 * - getUserScopedClient: ผูกกับ session ของผู้ใช้ที่ยิง request มา ต้องผ่าน RLS ปกติ
 *
 * หลักการ: ห้ามใช้ service role client ใน API route ที่ผู้ใช้ทั่วไปเรียกตรง
 * เพราะจะ bypass RLS ทั้งหมด — ใช้ได้เฉพาะ internal/cron endpoint ที่ตรวจสิทธิ์เองแล้ว
 */

let serviceRoleClient: SupabaseClient | null = null;

export function getServiceRoleClient(): SupabaseClient {
  if (serviceRoleClient) return serviceRoleClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'ขาด environment variable: SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  serviceRoleClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceRoleClient;
}

export function getUserScopedClient(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('ขาด environment variable: SUPABASE_URL หรือ SUPABASE_ANON_KEY');
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
