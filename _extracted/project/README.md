# CKTONLINE — Gap Closure: แพ็กเกจรวมทุกเฟส (Full-Stack Lifecycle)
**อัปเดตล่าสุด: 2026-07-04 | สถานะ: 101/101 unit tests ผ่าน (+5 integration test skeleton), 0 TypeScript errors**

แพ็กเกจนี้รวม**ทุกขั้นตอนตั้งแต่ต้นจนจบ**ของกระบวนการ Full-Stack Lifecycle (FSL) 8 เฟส
สำหรับปิด 10 gap ที่พบจากการเทียบ `CKT_Online_System_Blueprint.pdf` กับสถานะระบบ CKTONLINE Enterprise ปัจจุบัน

## แผนที่ไฟล์ตามเฟส FSL

| เฟส | อยู่ที่ไหน | สรุปสั้น |
|---|---|---|
| **1. Analyze** | `docs/00_analyze/` | Gap analysis 10 รายการ + Blueprint ต้นฉบับ (PDF/zip) เก็บไว้อ้างอิง |
| **2. Design** | `docs/01_design_docs/` | สถาปัตยกรรม, DB schema, API contract ของทั้ง 10 gap (10 ไฟล์ + SQL) |
| **3. Implement** | `supabase/migrations/`, `src/lib/`, `src/app/api/`, `src/components/`, `src/hooks/` | โค้ดจริงทั้ง Backend + Frontend |
| **4. Test** | `tests/` | 101 unit tests (pure logic, ไม่ต้องมี DB) + 5 integration test skeleton (`tests/integration/`) |
| **5-7. Debug / Root Cause / Fix** | ดูหัวข้อ "บั๊กที่พบและวิธีแก้" ด้านล่าง | บันทึกทุกบั๊กที่เจอจริงระหว่างพัฒนา พร้อม root cause |
| **8. Deliver** | ไฟล์นี้ (README.md) | สรุปงาน + Next Steps |

## โครงสร้างไฟล์ทั้งหมด
```
cktonline-gap/
├── docs/
│   ├── 00_analyze/
│   │   ├── gap_analysis.md              # เฟส 1: รายการ gap ทั้ง 10 + การประเมินความเสี่ยง
│   │   └── original_blueprint/          # ไฟล์ต้นฉบับที่ใช้วิเคราะห์ (PDF + zip)
│   └── 01_design_docs/                  # เฟส 2: เอกสารออกแบบ 10 หัวข้อ (architecture, security, financial, ...)
├── supabase/migrations/                 # เฟส 3: Database schema, RLS, triggers, cron, materialized views
├── src/
│   ├── lib/                             # เฟส 3: Business logic (pure functions, ทดสอบได้โดยไม่ต้องมี DB จริง)
│   ├── app/api/                         # เฟส 3: API routes (Next.js App Router)
│   ├── components/                      # เฟส 3: Frontend UI (Advance Requests, MFA, Analytics, Offline indicator)
│   ├── hooks/                           # เฟส 3: useGpsTracking
│   └── types/index.ts                   # Shared TypeScript types
└── tests/                               # เฟส 4: Unit tests (101) + Integration test skeleton (5, skip)
```

## บั๊กที่พบและวิธีแก้ (เฟส 5-7: Debug → Root Cause → Permanent Fix)

| บั๊ก | Root Cause | Fix ถาวร |
|---|---|---|
| `NextResponse` รับ `Buffer` จาก exceljs ไม่ได้ (type error) | Node `Buffer` type ไม่ตรงกับ `BodyInit` ของ Web API ใน TS lib defs | แปลงเป็น `Uint8Array` ทุกจุดที่ export ไฟล์ binary (Excel และ PDF) เป็นมาตรฐานเดียวกัน |
| หน้า Admin กดอนุมัติเงินสำรองไม่ได้ — ไม่มี id ให้เรียก API | ตอนสร้าง `advance_requests` ไม่เคย insert แถวคู่กันใน `approvals` (polymorphic table) ทำให้ไม่มีจุดเชื่อม | แก้ POST `/api/advance-requests` ให้สร้างทั้งสองแถวแบบ atomic (rollback ถ้าฝั่งใดฝั่งหนึ่ง fail) + GET join คืน `approval_id` เสมอ |

## วิธีติดตั้งเข้ากับโปรเจกต์เดิม
1. คัดลอก `supabase/migrations/*.sql` ไปวางในโฟลเดอร์ migrations ของโปรเจกต์เดิม แล้วรัน `supabase db push`
   - **ข้อควรระวัง:** Migration 002 อ้างถึงตาราง `cod_transactions`, `checkout_tickets`, `ocr_results` ที่มีอยู่แล้วในระบบเดิม — ตรวจสอบชื่อคอลัมน์ให้ตรงกับ schema จริงก่อนรัน (โดยเฉพาะ `net_revenue`, `commission_amount`, `ocr_decision`)
2. คัดลอก `src/lib`, `src/app/api`, `src/components`, `src/hooks`, `src/types` ไปรวมกับโปรเจกต์ Next.js เดิม (ไม่ทับไฟล์เดิม เพราะเป็น path ใหม่ทั้งหมด)
3. ตั้งค่า environment variables เพิ่ม:
   ```
   LINE_CHANNEL_ACCESS_TOKEN=
   LINE_LOGIN_CHANNEL_ID=
   LINE_LOGIN_REDIRECT_URI=
   INTERNAL_DISPATCH_SECRET=
   SUPABASE_SERVICE_ROLE_KEY=
   ```
4. รัน `npm install` (เพิ่ม dependency: `exceljs`, `zod`, `@react-pdf/renderer`, `date-fns-tz`, `recharts`, `idb`)
5. รัน `npm run typecheck && npm test` เพื่อยืนยันว่ายังผ่านครบก่อน deploy

## สถานะแต่ละ Gap (ครบทั้ง 10 รายการ)

| # | Gap | สถานะ | หมายเหตุ |
|---|---|---|---|
| 1 | MFA / RLS / Signed URL | ✅ Logic + API route + UI (`MfaEnrollment`) พร้อม | RLS policy อยู่ใน migration 001, ต้องรัน checklist ตรวจตารางเก่าเพิ่ม |
| 2 | LINE Notify → Messaging API | ✅ Client + retry + trigger พร้อม | ต้องขอ Channel Access Token จาก LINE Developers Console เอง |
| 3 | After-hours Fraud Alert | ✅ DB trigger + pure logic พร้อม | ผูกกับ `cod_transactions`, `advance_requests` แล้ว |
| 4 | SuperAdmin Analytics | ✅ Materialized view + API + UI (Recharts) พร้อม | Refresh ทุก 1 ชม. ผ่าน pg_cron |
| 5 | Advance Requests + Approval | ✅ เต็มรูปแบบ ครบ UI (`AdvanceRequestForm`/`AdvanceRequestAdminPanel`) | แยกธีมสีจาก COD ตามสเปค |
| 6 | Report Engine (PDF+Excel) | ✅ ครบทั้ง 2 format | pdf/xlsx/csv ทำงานผ่าน route เดียวกัน |
| 7 | Cron Auto-Delete | ✅ SQL migration พร้อม + soft-delete safety net | ต้องเปิด `pg_cron` extension ใน Supabase project ก่อน |
| 8 | Offline Sync | ✅ Queue logic + IndexedDB adapter + UI indicator ครบ | `OfflineSyncIndicator` component พร้อมใช้ |
| 9 | GPS Tracking ต่อเนื่อง | ✅ ครบ Backend + Frontend | `useGpsTracking` hook + sampling logic (battery-aware) |
| 10 | Database schema | ✅ ครบ พร้อม RLS ทุกตาราง | — |

**สถานะรวม: ปิดครบทุก gap ที่ระบุไว้เดิม 10/10** เหลือเพียง **Integration Test ที่ต้องไปรันกับ Supabase จริง** (ทำไม่ได้ใน sandbox นี้ — ดูคำแนะนำใน `tests/integration/`)

## Next Steps (เฟส 8: Deliver & Future Roadmap)
1. **รัน Integration Test จริง** — ทำตามขั้นตอนใน `tests/integration/rls-and-triggers.integration.test.ts` กับ Supabase local หรือ staging ก่อน deploy ขึ้น production
2. **Rate limiting** สำหรับ `/api/gps/batch` และ `/api/advance-requests` เพื่อป้องกัน abuse (ยังไม่มีในรอบนี้)
3. **Monitoring**: เพิ่ม alert ถ้า `cron_run_log` มี `status = 'failed'` ติดกันเกิน 2 ครั้ง (เพื่อจับ cron ที่ fail เงียบๆ)
4. **E2E test** (Playwright) สำหรับ flow สำคัญ: ขอเบิกเงิน → อนุมัติ → หักคืนอัตโนมัติ ตอน checkout ครั้งถัดไป
5. **Push notification จริงสำหรับ stuck offline actions** — ตอนนี้ `OfflineSyncIndicator` แสดงผลบน UI เท่านั้น ยังไม่แจ้ง Admin แบบ proactive ถ้าคนขับมีรายการค้าง sync นานเกินไป
