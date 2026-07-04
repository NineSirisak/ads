# CKTONLINE — Design Update (Gap Closure Package)
**เฟส: Design (ขั้นที่ 2 ของ Full-Stack Lifecycle)**
วันที่จัดทำ: 2026-07-04

## เอกสารนี้คือ Design เพิ่มเติมสำหรับ 10 Gap ที่พบจากการเทียบ Master Blueprint กับสถานะระบบปัจจุบัน

| # | Gap | ไฟล์ Design |
|---|-----|-------------|
| 1 | MFA / RLS / Signed URL | `04_security/security_design.md` |
| 2 | LINE Notify / Email / After-hours Fraud Alert | `05_notification/notification_design.md` |
| 3 | SuperAdmin Analytics | `01_architecture/superadmin_analytics_design.md` |
| 4 | Advance Requests + Approval Workflow | `06_financial/financial_workflow_design.md` |
| 5 | PDF/Excel Report Engine | `07_reporting/report_engine_design.md` |
| 6 | Auto-Delete Logs (Cron 15/45 วัน) | `08_data_lifecycle/data_lifecycle_design.md` |
| 7 | Offline Sync (Driver PWA) | `09_offline_sync/offline_sync_design.md` |
| 8 | Real-time GPS Tracking | `10_gps_tracking/gps_tracking_design.md` |
| 9 | Database Schema เพิ่มเติม | `02_database/schema_additions.sql` |
| 10 | API Contract รวมทุกโมดูลใหม่ | `03_api_contracts/api_contracts.md` |

## หลักการออกแบบร่วม (Design Principles)
- **Zero-breaking-change**: ทุก schema/endpoint ใหม่ต้องไม่กระทบของเดิม (38/38 tests ที่ผ่านอยู่ต้องยังผ่าน)
- **RLS-first**: ทุกตารางใหม่ต้องมี RLS policy ตั้งแต่ migration แรก ไม่ใช่แพตช์ทีหลัง
- **Append-only audit**: log ที่เกี่ยวกับการเงิน/ความปลอดภัยต้อง insert-only ห้าม update/delete จาก client
- **Progressive enhancement**: Offline Sync และ GPS ต้อง degrade gracefully เมื่อไม่มีสัญญาณ ไม่ทำให้แอปพัง

## ลำดับการ Implement ที่แนะนำ (Priority)
1. Database schema + RLS (ฐานของทุกอย่าง)
2. Security (MFA, Signed URL) — ความเสี่ยงสูงสุดถ้าไม่มี
3. Advance Requests + Approval Workflow — กระทบเงินจริง
4. LINE Notify + After-hours Fraud Alert — เชื่อมกับ anti-fraud pipeline ที่มีอยู่
5. Report Engine (PDF/Excel)
6. SuperAdmin Analytics
7. Cron auto-delete
8. Offline Sync + GPS tracking ต่อเนื่อง (ทำเฟสหลังเพราะกระทบ Service Worker ทั้งระบบ)

## Next Steps
เมื่อคุณ confirm ลำดับ ผมจะเข้าเฟส **Implement** ทันที (เขียนโค้ดจริง: migration, API route, component) ตาม FSL ที่ตั้งไว้ — ไม่มีการลด scope หรือหยุดสรุปก่อนเสร็จ
