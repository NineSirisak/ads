# API Contracts — โมดูลใหม่ทั้งหมด (Gap Closure)

รูปแบบ: REST, Next.js App Router (`route.ts`), auth ผ่าน Supabase session, response เป็น JSON เว้นแต่ export endpoint

## Auth / MFA
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/auth/mfa/enroll` | — | `{ qr_code, secret }` |
| POST | `/api/auth/mfa/verify` | `{ code }` | `{ session }` |
| POST | `/api/auth/mfa/backup-codes/regenerate` | — | `{ codes: string[] }` |

## Files (Signed URL)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/files/:id/signed-url` | — | `{ url, expires_at }` |

## Advance Requests
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/advance-requests` | `{ amount, reason }` | `{ request_no, status }` |
| GET | `/api/advance-requests?status=pending` | — | `AdvanceRequest[]` |
| GET | `/api/advance-requests/:driver_id/outstanding` | — | `{ outstanding_amount }` |

## Approvals (generic)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/approvals/:id/decide` | `{ decision, reason }` | `{ decision, decided_at }` |

## Notifications
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/notify/line/link` | — | `{ redirect_url }` (LINE OAuth) |
| POST | `/api/notify/email/send-report` | `{ to, report_id }` | `{ status }` |
| POST | `/api/notify/dispatch` *(internal, service-role only)* | `{ channel, target, payload }` | `{ status }` |

## Reports
| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/api/reports/daily-summary` | `date, format=pdf|xlsx|csv` | binary file |

## SuperAdmin Analytics
| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/api/superadmin/analytics/revenue` | `range, brand` | `RevenueSummary[]` |
| GET | `/api/superadmin/analytics/fraud-rate` | `range` | `FraudRateTrend[]` |
| GET | `/api/superadmin/analytics/driver-performance` | `driver_id` | `DriverPerformance` |
| GET | `/api/superadmin/analytics/vehicle-utilization` | `region` | `VehicleUtilization[]` |

## GPS
| Method | Path | Body/Query | Response |
|---|---|---|---|
| POST | `/api/gps/batch` | `{ pings: GpsPing[] }` | `{ inserted: number }` |
| GET | `/api/gps/live/:job_id` | — | `{ lat, lng, captured_at }` |

## ทุก endpoint ต้องผ่าน
1. Session validation (Supabase middleware)
2. RLS ที่ DB layer เป็น defense ชั้นสอง (ไม่พึ่ง application-layer check อย่างเดียว)
3. `audit_logs` insert สำหรับ endpoint ที่กระทบเงิน/สิทธิ์ (advance, approvals, mfa)

## TypeScript types (สำหรับใช้ร่วม frontend/backend)
```ts
interface AdvanceRequest {
  id: string;
  request_no: string;
  driver_id: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed' | 'settled';
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
}

interface GpsPing {
  lat: number;
  lng: number;
  accuracy_m?: number;
  captured_at: string;
  job_id?: string;
}

interface RevenueSummary {
  day: string;
  courier_brand: string;
  total_net_revenue: number;
  total_jobs: number;
}
```
