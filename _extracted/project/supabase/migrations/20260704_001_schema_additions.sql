-- ============================================================
-- CKTONLINE — Schema Additions (Gap Closure)
-- Target: Supabase (PostgreSQL 15+)
-- หลักการ: ทุกตารางมี RLS, ทุกตารางการเงิน/ความปลอดภัยเป็น append-only
-- ============================================================

-- ------------------------------------------------------------
-- 1. RBAC ที่ละเอียดขึ้น (แยก roles / permissions ออกจาก users)
-- ------------------------------------------------------------
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,              -- SuperAdmin / Admin / Driver
  description text,
  created_at timestamptz default now()
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,              -- e.g. 'cod.approve', 'report.export'
  description text
);

create table if not exists role_permissions (
  role_id uuid references roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- ------------------------------------------------------------
-- 2. MFA
-- ------------------------------------------------------------
create table if not exists user_mfa (
  user_id uuid primary key references auth.users(id) on delete cascade,
  method text not null check (method in ('totp','sms','email')),
  secret_encrypted text,                  -- encrypted at application layer, never plaintext
  is_enabled boolean default false,
  backup_codes_hash text[],               -- hashed, one-time use
  last_verified_at timestamptz,
  created_at timestamptz default now()
);

alter table user_mfa enable row level security;
create policy "user reads own mfa" on user_mfa
  for select using (auth.uid() = user_id);
create policy "user manages own mfa" on user_mfa
  for update using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. Warehouses / Settings / Files (centralized)
-- ------------------------------------------------------------
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  region text,
  area text,
  dc_name text,                            -- Distribution Center
  created_at timestamptz default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now()
);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  object_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  related_table text,                      -- e.g. 'cod_transactions'
  related_id uuid,
  is_signed_url_only boolean default true, -- ห้ามเข้าถึง public โดยตรง
  created_at timestamptz default now()
);

alter table files enable row level security;
create policy "own or admin can read files" on files
  for select using (
    uploaded_by = auth.uid()
    or exists (select 1 from user_roles ur join roles r on ur.role_id = r.id
               where ur.user_id = auth.uid() and r.name in ('Admin','SuperAdmin'))
  );

-- ------------------------------------------------------------
-- 4. Advance Requests (เบิกจ่ายเงินสำรองคนขับ) — แยกจาก COD เด็ดขาด
-- ------------------------------------------------------------
create table if not exists advance_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text unique not null,         -- ADV + YYYYMMDD + 4-digit seq
  driver_id uuid not null references auth.users(id),
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','disbursed','settled')),
  requested_at timestamptz default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  disbursed_at timestamptz,
  settled_at timestamptz,               -- เมื่อหักคืนจากรายได้คนขับครบ
  notes text
);

alter table advance_requests enable row level security;
create policy "driver sees own advance" on advance_requests
  for select using (driver_id = auth.uid());
create policy "admin sees all advance" on advance_requests
  for select using (
    exists (select 1 from user_roles ur join roles r on ur.role_id = r.id
            where ur.user_id = auth.uid() and r.name in ('Admin','SuperAdmin'))
  );

-- ------------------------------------------------------------
-- 5. Approval Workflow (generic, ใช้ร่วมกับ COD / Advance / อื่นๆ)
-- ------------------------------------------------------------
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,               -- 'cod_transaction' | 'advance_request'
  entity_id uuid not null,
  requested_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  decision text check (decision in ('pending','approved','rejected')) default 'pending',
  decision_reason text,
  created_at timestamptz default now(),
  decided_at timestamptz
);

alter table approvals enable row level security;
create policy "admin manages approvals" on approvals
  for all using (
    exists (select 1 from user_roles ur join roles r on ur.role_id = r.id
            where ur.user_id = auth.uid() and r.name in ('Admin','SuperAdmin'))
  );

-- ------------------------------------------------------------
-- 6. Notification channels (LINE / Email / Push รวมศูนย์)
-- ------------------------------------------------------------
create table if not exists notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  channel text not null check (channel in ('line','email','web_push')),
  target text not null,                    -- LINE user id / email / push subscription id
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  target text not null,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  error text,
  created_at timestamptz default now(),
  sent_at timestamptz
);
-- append-only: no update/delete policy granted to non-service-role

-- ------------------------------------------------------------
-- 7. Audit Log แยกจาก Activity Log
-- ------------------------------------------------------------
-- audit_logs: เหตุการณ์ที่กระทบข้อมูลสำคัญ/การเงิน/สิทธิ (append-only, ห้ามลบ)
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,                    -- 'approve_cod', 'change_role', ...
  entity_type text,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address text,
  created_at timestamptz default now()
);

-- activity_logs: กิจกรรมทั่วไปสำหรับ live feed ของ Admin Command Center
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  event_type text not null,
  message text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table audit_logs enable row level security;
create policy "only superadmin reads audit" on audit_logs
  for select using (
    exists (select 1 from user_roles ur join roles r on ur.role_id = r.id
            where ur.user_id = auth.uid() and r.name = 'SuperAdmin')
  );
-- ไม่มี policy สำหรับ insert/update/delete จาก client => เขียนได้เฉพาะผ่าน service role / trigger

-- ------------------------------------------------------------
-- 8. GPS tracking ต่อเนื่อง (ไม่ใช่แค่จุดเดียวตอน check-in)
-- ------------------------------------------------------------
create table if not exists gps_pings (
  id bigint generated always as identity primary key,
  driver_id uuid not null references auth.users(id),
  job_id uuid,                              -- ผูกกับงานที่กำลังทำ ถ้ามี
  lat double precision not null,
  lng double precision not null,
  accuracy_m numeric,
  captured_at timestamptz not null default now(),
  synced_offline boolean default false      -- true = ถูกส่งย้อนหลังจาก offline queue
);
-- Partition แนะนำ: by month, เพราะจะมีข้อมูลจำนวนมาก

create index if not exists idx_gps_pings_driver_time on gps_pings (driver_id, captured_at desc);

alter table gps_pings enable row level security;
create policy "driver writes own gps" on gps_pings
  for insert using (driver_id = auth.uid());
create policy "admin reads gps" on gps_pings
  for select using (
    exists (select 1 from user_roles ur join roles r on ur.role_id = r.id
            where ur.user_id = auth.uid() and r.name in ('Admin','SuperAdmin'))
  );

-- ------------------------------------------------------------
-- 9. Cron bookkeeping table (สำหรับ auto-delete logs)
-- ------------------------------------------------------------
create table if not exists cron_run_log (
  id bigint generated always as identity primary key,
  job_name text not null,
  ran_at timestamptz default now(),
  rows_affected integer,
  status text check (status in ('success','failed')),
  error text
);
