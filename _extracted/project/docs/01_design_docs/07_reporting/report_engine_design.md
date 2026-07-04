# Report Engine Design — PDF/Excel Export

## ปัจจุบัน
มี CSV export (UTF-8 BOM สำหรับภาษาไทย) แล้ว — ทำงานดีสำหรับ import เข้า Excel แต่สเปคต้องการไฟล์ **PDF/Excel สรุปยอดบัญชีประจำวัน**แบบพร้อมใช้ทันที (ไม่ใช่แค่ raw data)

## Excel (.xlsx) — สรุปพร้อม format
**Library:** `exceljs` (รองรับ styling, merge cell, ภาษาไทยเต็มรูปแบบ, ทำงานได้ทั้ง client/server)

**เนื้อหารายงาน:**
- Sheet 1: สรุปยอดรวมต่อ courier brand
- Sheet 2: รายละเอียดรายการ (ticket-level) พร้อม net revenue หลังหัก commission และหัก advance
- Header/Footer มีโลโก้ CKT Online + วันที่ออกรายงาน

```ts
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
const summary = wb.addWorksheet('สรุปยอด');
summary.columns = [
  { header: 'บริษัทขนส่ง', key: 'brand', width: 20 },
  { header: 'ยอดรวม (บาท)', key: 'total', width: 15 },
];
```

## PDF — สรุปบัญชีประจำวัน (สำหรับพิมพ์/ส่งผู้บริหาร)
**Library:** `@react-pdf/renderer` (เขียนเป็น React component ได้ ตรงกับ stack ที่ทีมคุ้นเคยอยู่แล้ว) หรือ `pdf-lib` ถ้าต้องการ fill template PDF ที่มีอยู่

**Layout:** โลโก้ + วันที่ + ตารางสรุปยอดต่อ brand + ยอด advance ที่ค้าง + ลายเซ็นผู้อนุมัติ (placeholder)

## API
```
GET /api/reports/daily-summary?date=2026-07-04&format=pdf
GET /api/reports/daily-summary?date=2026-07-04&format=xlsx
GET /api/reports/daily-summary?date=2026-07-04&format=csv   -- ของเดิม ยังใช้ได้
```

## Generation strategy
- รายงานที่ไม่ใหญ่ (รายวัน) → generate on-demand ตอนกด export
- รายงานสรุปรายเดือน (ใหญ่ขึ้น) → generate แบบ background job แล้วเก็บไฟล์ผ่าน Signed URL (ผูกกับ Security Design) แจ้งทาง email เมื่อพร้อม
