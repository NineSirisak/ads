# 🚀 คู่มือ Auto-Deploy บน Vercel (ภาษาไทย)

เอกสารนี้อธิบายวิธี **auto-deploy โปรเจกต์ CKTONLINE นี้ขึ้น Vercel** แบบตั้ง 1 ครั้ง แล้ว push โค้ดใหม่จะ deploy ให้อัตโนมัติ

---

## 📋 สิ่งที่ต้องมีก่อนเริ่ม
1. บัญชี [Vercel](https://vercel.com) (สมัครฟรีด้วย GitHub ได้)
2. บัญชี GitHub / GitLab / Bitbucket (แนะนำ **GitHub**)
3. Supabase project ที่รัน migration ครบแล้ว (มี `SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`)
4. LINE Messaging API channel (ถ้าจะใช้ notification) — ดูวิธีใน `docs/01_design_docs/`

---

## 🅰️ วิธีที่ 1: Deploy ผ่านหน้าเว็บ Vercel (แนะนำสำหรับผู้ใช้ทั่วไป)

### ขั้นที่ 1: Push โค้ดขึ้น GitHub
```bash
# ใน terminal ที่อยู่ในโฟลเดอร์โปรเจกต์
git init
git add .
git commit -m "chore: initial commit — CKTONLINE gap closure"

# สร้าง repo ใหม่บน GitHub ก่อน แล้วเชื่อม remote
git branch -M main
git remote add origin https://github.com/<username>/cktonline-gap.git
git push -u origin main
```

### ขั้นที่ 2: Import เข้า Vercel
1. เข้า https://vercel.com/new
2. เลือก repo `cktonline-gap` ที่เพิ่ง push ขึ้นไป
3. Vercel จะตรวจจับ **Next.js** ให้อัตโนมัติ → กดปุ่ม **Import**
4. **ตั้งค่า Environment Variables** (สำคัญมาก — ดูตารางด้านล่าง)
5. กด **Deploy**

### ขั้นที่ 3: ตั้ง Environment Variables
เข้า **Project → Settings → Environment Variables** แล้วเพิ่มตัวแปรต่อไปนี้ทีละตัว
เลือกทั้ง 3 environment: `Production`, `Preview`, `Development`

| ชื่อ Variable | ตัวอย่างค่า | Sensitive? |
|---|---|---|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | ปกติ |
| `SUPABASE_ANON_KEY` | `eyJhbGciOi...` | ปกติ |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | ⚠️ **Secret** — เลือก type "Sensitive" |
| `LINE_CHANNEL_ACCESS_TOKEN` | `Bearer xxx...` | ⚠️ Sensitive |
| `LINE_LOGIN_CHANNEL_ID` | `1234567890` | ปกติ |
| `LINE_LOGIN_REDIRECT_URI` | `https://<your-project>.vercel.app/api/notify/line/link` | ปกติ |
| `INTERNAL_DISPATCH_SECRET` | (สุ่ม 32 bytes: `openssl rand -hex 32`) | ⚠️ Sensitive |

> ⚠️ **ห้ามใส่ prefix `NEXT_PUBLIC_`** กับตัวที่เป็น secret เพราะจะถูก bundle ไปที่ client

### ขั้นที่ 4: (Optional) เปิด Cron Jobs
Vercel Cron ถูกกำหนดไว้ใน `vercel.json` แล้ว 2 งาน:
- `/api/reports/daily-summary` — รันทุกวันเวลา 01:00 UTC (≈ 08:00 เวลาไทย)
- `/api/notify/dispatch` — รันทุก 5 นาที (ส่ง notification ที่ค้างในคิว)

Cron จะเปิดใช้อัตโนมัติหลัง deploy ครั้งแรก ดูสถานะได้ที่ **Project → Cron Jobs**

---

## 🅱️ วิธีที่ 2: Deploy ผ่าน Vercel CLI (สำหรับ dev / CI)

```bash
# ติดตั้ง CLI แค่ครั้งเดียว
npm i -g vercel

# ล็อกอิน
vercel login

# ผูกโฟลเดอร์นี้กับ project บน Vercel (ครั้งแรก)
vercel link

# นำ env จาก Vercel ลงมาเป็น .env.local (สำหรับรัน dev)
vercel env pull .env.local

# Deploy preview (branch อื่นๆ ที่ไม่ใช่ main)
vercel

# Deploy production
vercel --prod
```

---

## 🔁 Auto-Deploy หลัง Setup เสร็จ

หลังจากขั้นที่ 2 เสร็จ Vercel จะทำงานอัตโนมัติดังนี้:

| การกระทำ | ผลลัพธ์ |
|---|---|
| `git push` ไป branch `main` | 🟢 **Production deploy** (URL: `https://<project>.vercel.app`) |
| `git push` ไป branch อื่น | 🟡 **Preview deploy** (URL แยกแต่ละ branch) |
| เปิด Pull Request | 🟡 **Preview deploy** + comment URL ลงใน PR อัตโนมัติ |
| Merge PR | 🟢 Production deploy อัตโนมัติ |

---

## ✅ Checklist หลัง Deploy ครั้งแรก

- [ ] เปิด `https://<project>.vercel.app` แล้วเห็นหน้า "CKTONLINE ✅ Deployed"
- [ ] เรียก `https://<project>.vercel.app/api/health` ได้ผลลัพธ์ JSON `{"ok": true, ...}`
- [ ] ที่ Vercel dashboard → **Cron Jobs** → ต้องเห็น 2 job สถานะ Active
- [ ] ทดสอบเรียก 1 API ด้วย token จริง เช่น `POST /api/advance-requests`
- [ ] ตั้งค่า custom domain (ถ้ามี) ที่ **Settings → Domains**
- [ ] อัปเดต `LINE_LOGIN_REDIRECT_URI` ให้ตรงกับ domain จริงหลังผูก custom domain

---

## 🛠 การแก้ปัญหาที่เจอบ่อย

**Build fail: "Cannot find module 'next'"**
→ ยังไม่ได้ push `package.json` ใหม่ ตรวจว่า `next` อยู่ใน `dependencies` (ไม่ใช่ devDependencies)

**API 500: "ขาด environment variable"**
→ ลืมใส่ env var บน Vercel — เข้าไปเพิ่มใน Settings แล้วกด **Redeploy**

**Cron ไม่รัน**
→ Vercel Cron ใช้ได้เฉพาะ plan **Hobby (จำกัด 2 cron) หรือ Pro** ตรวจสอบ plan และเข้าเมนู Cron Jobs

**Timeout บน API ที่ส่ง PDF/Excel ใหญ่**
→ ปรับ `maxDuration` ใน `vercel.json` (default = 10s สำหรับ Hobby, สูงสุด 60s สำหรับ Pro)

---

**สรุป:** หลังตั้งค่าตามคู่มือนี้เสร็จ ทุกครั้งที่คุณ `git push` ไป `main` โปรเจกต์จะ deploy ขึ้น production อัตโนมัติ 🎉
