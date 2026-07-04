# Financial Workflow Design — Advance Requests + Approval

## หลักการสำคัญที่สุด (จากสเปคจุดที่ 4.1)
> "แยกหน้าต่างการจัดการรายได้หลัก และการเบิกจ่ายเงินสำรองของคนขับออกจากกันอย่างเด็ดขาด"

→ **ห้าม** ใช้ตารางหรือหน้า UI เดียวกันกับ `cod_transactions` แม้จะดูคล้ายกัน เพราะ:
- COD = เงินลูกค้าที่คนขับเก็บมาแทนบริษัท (ต้องส่งเข้าบริษัท)
- Advance = เงินบริษัทให้คนขับยืมล่วงหน้า (ต้องหักคืนจากรายได้คนขับ)
ตรงข้ามทิศทางเงินกันโดยสิ้นเชิง ถ้าปนกันจะกระทบความถูกต้องของงบดุล

## Advance Request Flow
```
Driver ขอเบิก (amount, reason)
   → status: pending
   → Admin เห็นใน "คำขอเบิกเงินสำรอง" (แยกจากหน้า COD)
   → Admin approve/reject (บันทึกลง approvals + audit_logs)
   → ถ้า approved: status → disbursed (บันทึกวันที่จ่ายจริง)
   → ระบบหักคืนอัตโนมัติจาก net revenue ของคนขับในรอบถัดไป
       จนกว่า amount จะถูกหักครบ → status: settled
```

## Ticket numbering
ตาม pattern เดิมของระบบ (BK/CI/CO + YYYYMMDD + 4-digit):
`ADV` + YYYYMMDD + 4-digit sequence เช่น `ADV202607040007`

## การหักคืนอัตโนมัติ (Settlement Logic)
ที่ checkout ticket คำนวณ net revenue อยู่แล้ว → เพิ่ม step:
```ts
function applyAdvanceSettlement(netRevenue: number, driverId: string) {
  const outstanding = getOutstandingAdvances(driverId); // sum ที่ยัง disbursed ไม่ settled
  const deduction = Math.min(netRevenue, outstanding);
  return {
    netRevenueAfterAdvance: netRevenue - deduction,
    advanceDeducted: deduction,
  };
}
```
บันทึกยอดหักในทุก checkout ticket เพื่อ traceability (คนขับต้องเห็นว่าเงินหายไปไหน — สำคัญต่อความไว้ใจ)

## Approval Workflow (generic, reuse ได้กับ COD ด้วย)
ตาราง `approvals` ออกแบบให้ `entity_type` เป็น polymorphic:
- `cod_transaction` → ใช้แทนที่ 3-way OCR decision ปัจจุบันในเคสที่ pending_admin_review ต้องมีคน sign-off
- `advance_request` → ตามด้านบน

**API:**
```
POST /api/advance-requests                 -> driver สร้างคำขอ
GET  /api/advance-requests?status=pending   -> admin ดูรายการรออนุมัติ
POST /api/approvals/:id/decide              -> { decision, reason }
GET  /api/advance-requests/:driver_id/outstanding
```

## UI แยกหน้าจอ (ตามสเปค)
- `/admin/finance/cod` — หน้าเดิม ไม่แก้ไข
- `/admin/finance/advance-requests` — หน้าใหม่ พื้นหลัง/สีต่างกันชัดเจน (เช่น ใช้สี accent ต่างจาก COD) เพื่อลดความสับสนตามที่สเปคย้ำ
