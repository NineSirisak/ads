# Offline Sync Design — Driver PWA

## ปัญหาที่ต้องแก้
คนขับทำงานในพื้นที่ที่สัญญาณมือถือไม่ดี (โกดัง, พื้นที่ห่างไกล) — ถ้า Check-in/Check-out ต้อง online ตลอด ระบบจะใช้งานไม่ได้จริง

## Architecture
1. **Service Worker + IndexedDB** (ใช้ `idb` library เพื่อ wrap IndexedDB ให้เขียนง่ายขึ้น)
2. Action ที่ต้อง support offline: Check-in, Check-out, OCR scan (เก็บรูปไว้ก่อน), GPS ping
3. Queue table ใน IndexedDB: `pending_actions` เก็บ action + payload + timestamp + retry count

## Sync Flow
```
[Driver ทำ action] 
   → บันทึกลง IndexedDB ทันที + แสดงผล optimistic UI (สถานะ "รอ sync")
   → ถ้า navigator.onLine === true → ยิง sync ทันที
   → ถ้า offline → รอ 'online' event หรือ Background Sync API
   → Sync สำเร็จ → ลบจาก queue, อัปเดต UI เป็น "sync แล้ว"
   → Sync ล้มเหลว (conflict) → เก็บไว้ retry, แจ้งเตือนใน UI ให้ admin ตรวจสอบถ้า retry เกิน 3 ครั้ง
```

## Conflict Resolution
กรณีที่อาจชนกัน: Check-in ซ้ำ (ทำตอน offline 2 ครั้งโดยไม่รู้ตัว)
- ใช้ **idempotency key** ต่อ action (`uuid` สร้างตอนกดปุ่มครั้งแรก) — server เช็ค key ซ้ำแล้ว reject/merge แทนสร้าง record ใหม่

## GPS ตอน offline
เก็บ `gps_pings` ที่ capture ระหว่าง offline ใน IndexedDB → ตอน sync ยิง batch insert พร้อม flag `synced_offline = true` (ตามที่ออกแบบใน schema) เพื่อให้ analytics รู้ว่า timestamp เป็นของตอนที่บันทึกจริงหรือตอนที่ sync

## ข้อจำกัดที่ต้องแจ้งผู้ใช้
- รูปถ่าย/เอกสารที่ scan ตอน offline จะ queue ไว้ในเครื่อง — ถ้าคนขับล้าง cache/ถอนแอปก่อน sync ข้อมูลจะหาย → ต้องมี UI indicator ชัดเจนว่า "มี X รายการรอ sync" ค้างอยู่บนหน้าหลักเสมอ ไม่ซ่อนไว้
