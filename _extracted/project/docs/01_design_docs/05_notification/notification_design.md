# Notification Design — LINE Notify / Email / After-hours Fraud Alert

## 1. LINE Notify Integration

**เหตุผลที่ต้องมี:** สเปคจุดที่ 5.1 ระบุชัดว่าต้องแจ้งยอดค้างชำระ และแจ้งเตือนงานด่วนผ่าน LINE ซึ่งเป็นช่องทางที่คนขับ/แอดมินไทยเช็คบ่อยกว่า email

**หมายเหตุสำคัญ:** LINE Notify (บริการเดิม) **ปิดให้บริการแล้วในปี 2025** ต้องใช้ **LINE Messaging API** แทน (ผ่าน LINE Official Account + Channel Access Token) — นี่คือจุดที่ต้องปรับจากสเปคเดิม

**Flow:**
1. ผู้ใช้ผูก LINE ผ่าน LINE Login (OAuth) ครั้งเดียว → เก็บ `line_user_id` ใน `notification_channels`
2. Event เกิดขึ้น (เช่น COD ยอดไม่ตรง, งานด่วน) → enqueue เข้า `notification_log`
3. Worker (Edge Function) ดึงจาก queue → เรียก LINE Messaging API push message
4. อัปเดตสถานะ `sent` / `failed` กลับเข้า `notification_log`

**API:**
```
POST /api/notify/line/link          -> เริ่ม OAuth flow ผูก LINE
POST /api/notify/dispatch           -> internal, ใช้โดย event trigger เท่านั้น (service role)
```

**Retry policy:** ถ้า push ไม่สำเร็จ retry 3 ครั้ง (exponential backoff) แล้ว fallback เป็น Web Push ที่มีอยู่แล้ว

---

## 2. Email Notification

**ใช้สำหรับ:** สรุปรายงานประจำวัน/สัปดาห์ (แนบ PDF/Excel จาก Report Engine), และแจ้งเตือนที่ไม่ต้อง real-time

**Tech:** Resend หรือ Supabase's built-in SMTP — ใช้ template แบบ React Email เพื่อให้ดูแลง่าย

**API:**
```
POST /api/notify/email/send-report  -> { to, report_id }
```

---

## 3. ระบบเฝ้าระวังทุจริตนอกเวลางาน (After-hours Anomaly Alert)

**สเปค (จุดที่ 5.2):** หากมีการอัปเดตข้อมูลผิดปกติหลัง 20:00 น. → ส่ง Alert ไปกลุ่มไลน์แอดมินทันที

**Design — เชื่อมกับ Anti-Fraud Pipeline ที่มีอยู่แล้ว:**

1. **Trigger point:** Database trigger บนตารางที่มีความเสี่ยง (`cod_transactions`, `checkins`, `advance_requests`)
   ```sql
   create or replace function flag_after_hours_activity()
   returns trigger as $$
   begin
     if extract(hour from now() at time zone 'Asia/Bangkok') >= 20
        or extract(hour from now() at time zone 'Asia/Bangkok') < 6 then
       insert into activity_logs (actor_id, event_type, message, metadata)
       values (auth.uid(), 'after_hours_activity',
               'พบการอัปเดตข้อมูลนอกเวลางาน', jsonb_build_object('table', TG_TABLE_NAME, 'row_id', NEW.id));
       -- enqueue LINE alert
       insert into notification_log (channel, target, payload)
       values ('line', 'admin_group', jsonb_build_object(
         'text', 'พบการอัปเดตข้อมูลผิดปกติหลัง 20:00 น. ในตาราง ' || TG_TABLE_NAME
       ));
     end if;
     return NEW;
   end;
   $$ language plpgsql security definer;
   ```
2. ผูก trigger กับ `AFTER INSERT OR UPDATE` บนตารางเสี่ยง
3. **False-positive control:** ไม่ flag ถ้า action มาจาก cron job ระบบเอง (เช็คผ่าน `auth.uid() is null` = service role)
4. ระดับความรุนแรง (severity) แบ่งเป็น `info` (แจ้งเฉยๆ) / `warning` (ยอดเงิน > threshold) / `critical` (หลาย record ใน session เดียว) — ใช้ threshold ที่ config ได้จากตาราง `settings`

**เหตุผลที่ออกแบบเป็น DB trigger ไม่ใช่ application-layer check:** ป้องกันคนที่พยายาม bypass ผ่านการยิง API ตรงหรือแก้ไข DB โดยตรง (defense in depth)
