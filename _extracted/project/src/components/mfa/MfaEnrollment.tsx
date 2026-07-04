'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/apiClient';

interface MfaEnrollmentProps {
  accessToken: string;
  onEnrolled?: () => void;
}

type Step = 'idle' | 'enrolling' | 'awaiting-code' | 'done';

/**
 * Flow: enroll (ขอ QR code) -> ผู้ใช้ scan ด้วย Authenticator App -> กรอกโค้ด 6 หลัก -> verify
 * บังคับใช้เฉพาะ Admin/SuperAdmin ตาม MFA design (ดู docs/01_design_docs/04_security/security_design.md)
 */
export function MfaEnrollment({ accessToken, onEnrolled }: MfaEnrollmentProps) {
  const [step, setStep] = useState<Step>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function startEnrollment() {
    setError(null);
    setStep('enrolling');
    try {
      const result = await apiFetch<{ qr_code: string; secret: string; factor_id: string }>(
        '/api/auth/mfa/enroll',
        accessToken,
        { method: 'POST' }
      );
      setQrCode(result.qr_code);
      setFactorId(result.factor_id);
      setStep('awaiting-code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เริ่มตั้งค่า MFA ไม่สำเร็จ');
      setStep('idle');
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch('/api/auth/mfa/verify', accessToken, {
        method: 'POST',
        body: JSON.stringify({ factor_id: factorId, code }),
      });
      setStep('done');
      onEnrolled?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โค้ดไม่ถูกต้อง กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-5 text-green-800">
        ✅ ตั้งค่า MFA สำเร็จ — บัญชีของคุณปลอดภัยขึ้นแล้ว
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-2 text-lg font-bold text-gray-900">ตั้งค่ายืนยันตัวตนสองชั้น (MFA)</h2>
      <p className="mb-4 text-sm text-gray-600">
        บัญชี Admin/SuperAdmin ต้องตั้งค่า MFA ก่อนเข้าถึงหน้าจัดการระบบ
      </p>

      {error && <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</div>}

      {step === 'idle' && (
        <button
          onClick={startEnrollment}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
        >
          เริ่มตั้งค่า MFA
        </button>
      )}

      {step === 'enrolling' && <p className="text-sm text-gray-500">กำลังสร้าง QR code...</p>}

      {step === 'awaiting-code' && qrCode && (
        <div>
          <p className="mb-3 text-sm text-gray-700">
            สแกน QR code นี้ด้วยแอป Authenticator (เช่น Google Authenticator) แล้วกรอกโค้ด 6 หลักด้านล่าง
          </p>
          {/* qrCode เป็น data URI จาก Supabase Auth MFA enroll response */}
          <img src={qrCode} alt="MFA QR Code" className="mb-4 h-40 w-40" />
          <form onSubmit={verifyCode} className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-widest"
            />
            <button
              type="submit"
              disabled={isSubmitting || code.length !== 6}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              ยืนยัน
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
