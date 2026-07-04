# Security Design — MFA / RLS / Signed URL

## 1. MFA (Multi-Factor Authentication)

**ขอบเขต:** บังคับ MFA เฉพาะ `SuperAdmin` และ `Admin` (Driver ใช้ device + PIN สั้นพอ เพราะ MFA เต็มรูปแบบจะทำให้ field usability แย่)

**Flow:**
1. Login ด้วย email/password (Supabase Auth) → ได้ session ชั่วคราว (`aal1`)
2. ถ้า role ต้อง MFA และ `user_mfa.is_enabled = true` → เรียก TOTP challenge
3. ผู้ใช้กรอกโค้ด 6 หลักจาก Authenticator App → verify → อัปเกรดเป็น `aal2` session
4. Backup codes: สร้าง 10 โค้ด ครั้งเดียวตอนตั้งค่า, hash ด้วย bcrypt, ใช้ได้ครั้งเดียว/โค้ด

**Tech:** ใช้ Supabase Auth MFA (`supabase.auth.mfa.enroll / challenge / verify`) แทนการทำ TOTP เอง — ลด attack surface และไม่ต้องเก็บ secret เองทั้งหมด

**API:**
```
POST /api/auth/mfa/enroll        -> { qr_code, secret }
POST /api/auth/mfa/verify        -> { code } => { session }
POST /api/auth/mfa/backup-codes/regenerate
```

**Enforcement point:** Middleware (`middleware.ts`) เช็ค `session.aal` ก่อนเข้าถึง route ที่ขึ้นต้นด้วย `/admin` หรือ `/superadmin` — ถ้า `aal1` แต่ role ต้อง MFA → redirect ไปหน้า challenge

---

## 2. Row Level Security (RLS)

**หลักการ:** ทุกตาราง (เก่า+ใหม่) ต้องเปิด RLS และมี policy ที่ชัดเจน 3 ระดับ:
- Driver: เห็นเฉพาะข้อมูลของตัวเอง (`driver_id = auth.uid()`)
- Admin: เห็นข้อมูลปฏิบัติการทั้งหมด แต่**ไม่เห็น** audit_logs ระดับ SuperAdmin
- SuperAdmin: full access

**Checklist สำหรับตารางที่มีอยู่แล้ว (ต้องตรวจสอบย้อนหลัง):**
| ตาราง | RLS เปิดแล้ว? | Policy ครบ 3 role? |
|---|---|---|
| jobs / bookings / checkins | ต้องตรวจสอบ | ต้องตรวจสอบ |
| cod_transactions | ต้องตรวจสอบ | ต้องตรวจสอบ (การเงิน = สำคัญสูงสุด) |
| ocr_results | ต้องตรวจสอบ | ต้องตรวจสอบ |

> ⚠️ Action item: รัน `select tablename, rowsecurity from pg_tables where schemaname='public';` เพื่อตรวจว่ามีตารางไหนที่ RLS ยัง false อยู่ก่อน implement เพิ่ม

---

## 3. Signed URL สำหรับไฟล์ (สลิป, เอกสาร OCR, รูปหน้างาน)

**ปัญหาปัจจุบัน:** ถ้า Storage bucket เป็น public หรือใช้ URL ตรง → สลิปเงินโอน/เอกสารส่วนตัวคนขับรั่วไหลได้ถ้า URL หลุด

**Design:**
- Bucket ทั้งหมดตั้งเป็น **private**
- ทุกครั้งที่ frontend ต้องแสดงไฟล์ → เรียก API เพื่อขอ signed URL ที่มีอายุสั้น (เช่น 5 นาที)
- บันทึกทุกการขอ signed URL ลง `activity_logs` (ใครขอดูไฟล์ไหน เมื่อไร) เพื่อ traceability

**API:**
```
GET /api/files/:id/signed-url
  -> ตรวจสิทธิ์จาก files.uploaded_by หรือ role ก่อนออก signed URL
  -> response: { url, expires_at }
```

**Supabase implementation:**
```ts
const { data, error } = await supabase.storage
  .from(bucket)
  .createSignedUrl(objectPath, 300); // 5 นาที
```
