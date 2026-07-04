-- ============================================================
-- Migration 003 — Auto-delete cron jobs (15/45 วัน retention)
-- ============================================================

-- ลบ activity_logs เก่ากว่า 15 วัน ทุกวันตอนตี 3 (เวลาเซิร์ฟเวอร์)
select cron.schedule(
  'delete-old-activity-logs',
  '0 3 * * *',
  $$
  with deleted as (
    delete from activity_logs where created_at < now() - interval '15 days'
    returning 1
  )
  insert into cron_run_log (job_name, rows_affected, status)
  select 'delete-old-activity-logs', count(*), 'success' from deleted;
  $$
);

-- Soft-delete ไฟล์เก่ากว่า 45 วัน (ตั้ง deleted_at ก่อน ไม่ลบจริงทันที)
alter table files add column if not exists deleted_at timestamptz;

select cron.schedule(
  'soft-delete-old-files',
  '0 4 * * *',
  $$
  with updated as (
    update files
    set deleted_at = now()
    where created_at < now() - interval '45 days'
      and deleted_at is null
    returning 1
  )
  insert into cron_run_log (job_name, rows_affected, status)
  select 'soft-delete-old-files', count(*), 'success' from updated;
  $$
);

-- ลบไฟล์จริงที่ soft-delete มาแล้วเกิน 7 วัน (ให้เวลากู้คืนฉุกเฉิน)
-- หมายเหตุ: การลบ object จริงใน Storage ต้องทำผ่าน Edge Function เรียก Storage API
-- ที่นี่แค่ mark record ว่า 'ready_for_purge' ให้ Edge Function ไปประมวลผลต่อ
alter table files add column if not exists purge_status text default 'active'
  check (purge_status in ('active', 'ready_for_purge', 'purged'));

select cron.schedule(
  'mark-files-ready-for-purge',
  '30 4 * * *',
  $$
  update files
  set purge_status = 'ready_for_purge'
  where deleted_at < now() - interval '7 days'
    and purge_status = 'active';
  $$
);
