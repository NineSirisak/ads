# Data Lifecycle Design — Auto-Delete Logs (Cron)

## สเปคกำหนด
- พื้นที่จัดเก็บ (ไฟล์แนบ/รูปงาน): เก็บสูงสุด **45 วัน** แล้วลบอัตโนมัติ
- Log ทั่วไป (`activity_logs`): เก็บ **15 วัน** แล้วลบอัตโนมัติ
- **ข้อยกเว้นสำคัญ:** `audit_logs` (การเงิน/สิทธิ์) **ห้ามลบอัตโนมัติ** แม้สเปคไม่เจาะจง เพราะเป็น legal/compliance record — ต้องแยก retention policy ออกจาก log ทั่วไป

## Implementation — Supabase pg_cron
```sql
-- ลบ activity_logs เก่ากว่า 15 วัน ทุกวันตอนตี 3
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

-- ลบไฟล์เก่ากว่า 45 วัน (ลบ record ใน files ก่อน แล้ว trigger เรียก Storage API ลบ object จริง)
select cron.schedule(
  'delete-old-files',
  '0 4 * * *',
  $$ select cleanup_expired_files(); $$
);
```

`cleanup_expired_files()` เป็น Edge Function เพราะการลบไฟล์จริงใน Storage ต้องเรียก Storage API (ทำใน pure SQL ไม่ได้) — SQL function จะ mark record เป็น `pending_delete` แล้ว Edge Function ที่รันแยกจะไปลบไฟล์จริงและอัปเดตสถานะ

## Safety net
- ก่อนลบจริง ทำ **soft delete** ก่อน 7 วัน (ตั้ง `deleted_at`) เผื่อ Admin ต้องกู้คืนกรณีฉุกเฉิน (เช่น มีข้อพิพาทกับลูกค้าเรื่อง COD ย้อนหลัง)
- `cron_run_log` เก็บผลการรันทุกครั้งเพื่อ debug ได้ถ้า cron fail เงียบๆ
