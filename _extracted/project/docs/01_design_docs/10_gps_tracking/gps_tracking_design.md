# Real-time GPS Tracking Design

## ความแตกต่างจากที่มีอยู่
เดิม: จับ GPS แค่ 1 จุดตอน check-in (ยืนยันว่าคนขับอยู่ที่จุดส่งจริง)
เพิ่มใหม่: ติดตามตำแหน่งต่อเนื่องระหว่างที่ status = "กำลังส่งงาน" เพื่อ:
- แสดงตำแหน่งคนขับ live บน Admin Dashboard (ใช้วางแผน/support ลูกค้าที่ถาม "ของมาถึงไหนแล้ว")
- เป็นหลักฐานเพิ่มเติมสำหรับ anti-fraud (เทียบตำแหน่ง ping กับตำแหน่ง check-in ว่าสมเหตุสมผล)

## Sampling Strategy (สำคัญเพื่อไม่กินแบตคนขับ)
- Interval: ทุก 60 วินาที **เฉพาะตอนที่มีงาน active** (ไม่ ping ตลอดเวลาที่เปิดแอป)
- ใช้ `watchPosition` ของ Geolocation API พร้อม `enableHighAccuracy: false` ตอนปกติ (ประหยัดแบต), สลับเป็น `true` เฉพาะตอน check-in/check-out
- Batch ส่งขึ้น server ทุก 3 ping (ลด network call) เก็บ buffer ใน memory/IndexedDB ก่อน

## Privacy & Consent
- คนขับต้อง consent ชัดเจนว่าระบบจะ track ตำแหน่งระหว่างเวลางาน (ไม่ track ตอนนอกงาน/วันหยุด)
- แสดง indicator ในแอปตลอดเวลาที่กำลัง track อยู่ (ไม่ทำแบบซ่อน — ทั้งเพื่อความโปร่งใสและตาม PDPA)

## Data Flow
```
Driver PWA (watchPosition)
   → buffer ใน memory
   → ทุก 3 ping หรือทุก 3 นาที (แล้วแต่ถึงก่อน) → POST /api/gps/batch
   → insert เข้า gps_pings (ผูก schema เดิมที่ออกแบบไว้)
   → Admin Dashboard subscribe ผ่าน Supabase Realtime บนตาราง gps_pings (filter by active job)
```

## API
```
POST /api/gps/batch     -> { pings: [{lat, lng, accuracy_m, captured_at}] }
GET  /api/gps/live/:job_id   -> ตำแหน่งล่าสุดของงานนั้น (สำหรับ fallback ถ้า realtime ไม่ทำงาน)
```

## การเก็บรักษาข้อมูล
gps_pings มีปริมาณมาก → ผูกกับ Data Lifecycle Design: เก็บ raw ping 45 วัน แล้ว aggregate เป็น "เส้นทางสรุป" (1 จุดทุก 5 นาที) เก็บระยะยาวกว่าเพื่อการวิเคราะห์ ส่วน raw ทิ้งได้
