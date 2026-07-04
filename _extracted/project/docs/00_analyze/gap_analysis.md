# เฟส 1: วิเคราะห์ (Analyze)
วันที่: 2026-07-04
แหล่งข้อมูล: `CKT_Online_System_Blueprint.pdf` + `CKTONLINE_Enterprise_Master_Blueprint.zip` (ต้นฉบับอยู่ในโฟลเดอร์ `original_blueprint/`)

## วิธีวิเคราะห์
เทียบ Master Blueprint (สเปคเต็มของระบบ CKT Online) กับสถานะระบบที่พัฒนาไปแล้วจริง
(ticket numbering, GPS check-in, net revenue, vehicle grid, OCR 3-way decision, Driver PWA,
Admin Command Center, 38/38 tests ที่ผ่านในรอบก่อนหน้า) เพื่อหาช่องว่าง (Gap)

## Gap ที่พบ 10 รายการ

| # | Gap | หมวด | ความเสี่ยงถ้าไม่ปิด |
|---|---|---|---|
| 1 | MFA (Multi-Factor Authentication) | Security | บัญชี Admin/SuperAdmin เข้าถึงได้ด้วย password เดียว |
| 2 | RLS (Row Level Security) ยังไม่ยืนยันครบทุกตาราง | Security | ข้อมูลการเงิน/ส่วนตัวอาจรั่วข้าม role |
| 3 | Signed URL สำหรับไฟล์แนบ (สลิป/เอกสาร OCR) | Security | ไฟล์ private อาจเข้าถึงได้จาก URL ตรง |
| 4 | LINE Notify Integration (ของเดิมเลิกให้บริการแล้ว) | Notification | ไม่มีช่องทางแจ้งเตือนที่คนไทยใช้บ่อยที่สุด |
| 5 | ระบบเฝ้าระวังทุจริตนอกเวลางาน (After-hours) | Security/Fraud | ไม่มีการตรวจจับความผิดปกติแบบ real-time |
| 6 | SuperAdmin Analytics Dashboard | Business Intelligence | ผู้บริหารไม่มีข้อมูลเชิงกลยุทธ์แยกจาก operational dashboard |
| 7 | Advance Requests (เบิกจ่ายเงินสำรองคนขับ) + Approval Workflow | Financial | ปนกับ COD ได้ถ้าไม่แยกออกแบบชัดเจน กระทบงบดุล |
| 8 | Report Engine — PDF/Excel export | Reporting | มีแค่ CSV ไม่พร้อมส่งผู้บริหารทันที |
| 9 | Cron Auto-Delete Logs (retention policy) | Data Lifecycle | ข้อมูล log/ไฟล์สะสมไม่มีที่สิ้นสุด |
| 10 | Offline Sync + GPS Tracking ต่อเนื่อง | PWA/Mobile | ใช้งานไม่ได้จริงในพื้นที่สัญญาณไม่ดี |

## ประเมินความเสี่ยง/จุดคอขวด
- **ความเสี่ยงสูงสุด**: Advance Requests ปนกับ COD (กระทบเงินจริงและงบดุลถ้าผิดพลาด) และ RLS ที่ไม่ครบ (ข้อมูลรั่ว)
- **จุดคอขวดทางเทคนิค**: Offline Sync + GPS ต้องแก้ Service Worker ทั้งระบบ — เสี่ยงกระทบของเดิมมากที่สุด จึงจัดไว้ทำหลังสุด
- **Dependency**: SuperAdmin Analytics และ Report Engine ต้องพึ่ง Materialized View เดียวกัน — ควรทำ schema ก่อนแล้วค่อยต่อ 2 ฟีเจอร์นี้พร้อมกัน

## ผลจากการวิเคราะห์ → นำไปสู่เฟส Design
ดูรายละเอียดการออกแบบทั้ง 10 หัวข้อได้ที่ `../01_design_docs/`
