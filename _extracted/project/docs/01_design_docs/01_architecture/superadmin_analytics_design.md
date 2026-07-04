# SuperAdmin Analytics Dashboard — Design

## ความแตกต่างจาก Admin Command Center
Admin Command Center = operational (งานวันนี้, live feed, approve/reject)
SuperAdmin Analytics = strategic (แนวโน้ม, กำไร-รายจ่าย, ประสิทธิภาพเชิงเปรียบเทียบ)

## Metrics ที่ต้องมี
1. **รายได้-รายจ่ายสุทธิ รายวัน/สัปดาห์/เดือน** แยกตาม courier brand (KEX/J&T/SPX/Flash/Best)
2. **Net revenue per driver** เทียบกับ commission ที่หักไป (ใช้ logic net revenue ที่มีอยู่แล้วจาก check-out ticket)
3. **Fraud detection rate**: จำนวน ticket ที่ flagged_fraud / pending_admin_review / verified เทียบเป็น % ต่อเดือน — ดูเทรนด์ว่า OCR แม่นขึ้นหรือลงเรื่อยๆ
4. **Advance request outstanding**: ยอดเบิกจ่ายที่ยังไม่ settled ต่อคนขับ (risk exposure)
5. **Vehicle utilization**: จาก vehicle allocation grid — เทียบ allocated vs actual ใช้จริง ต่อ region/area/DC

## Architecture
- Query หนัก (aggregation) ไม่ควรยิงตรงจาก client → ใช้ **Materialized View** รีเฟรชทุก 1 ชม. (cron)
  ```sql
  create materialized view mv_daily_revenue_summary as
  select date_trunc('day', created_at) as day, courier_brand,
         sum(net_revenue) as total_net_revenue,
         count(*) as total_jobs
  from checkout_tickets
  group by 1, 2;
  ```
- Frontend ใช้ Recharts (มีอยู่แล้วใน stack) ดึงจาก view ผ่าน API แบบ paginated/date-range filter

## API
```
GET /api/superadmin/analytics/revenue?range=30d&brand=all
GET /api/superadmin/analytics/fraud-rate?range=90d
GET /api/superadmin/analytics/driver-performance?driver_id=...
GET /api/superadmin/analytics/vehicle-utilization?region=...
```

## Access control
Route `/superadmin/*` ต้อง `aal2` session (MFA แล้ว) + role = SuperAdmin เท่านั้น — ผูกกับ Security Design ข้อ 1
