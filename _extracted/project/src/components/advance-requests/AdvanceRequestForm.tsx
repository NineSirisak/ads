'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/apiClient';
import { createAdvanceRequestSchema } from '@/lib/advanceRequests';

interface AdvanceRequestFormProps {
  accessToken: string;
  onSubmitted?: (requestNo: string) => void;
}

/**
 * แยกธีมสีจาก COD อย่างชัดเจนตามสเปค (จุดที่ 4.1)
 * COD ใช้สีเขียว/น้ำเงินในระบบเดิม -> หน้านี้ใช้สีส้ม/อำพัน เพื่อไม่ให้คนขับสับสนว่าเป็นเงินประเภทเดียวกัน
 */
export function AdvanceRequestForm({ accessToken, onSubmitted }: AdvanceRequestFormProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successRequestNo, setSuccessRequestNo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = createAdvanceRequestSchema.safeParse({
      amount: Number(amount),
      reason,
    });

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiFetch<{ request_no: string; status: string }>(
        '/api/advance-requests',
        accessToken,
        { method: 'POST', body: JSON.stringify(parsed.data) }
      );
      setSuccessRequestNo(result.request_no);
      setAmount('');
      setReason('');
      onSubmitted?.(result.request_no);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
          เงินสำรอง
        </span>
        <h2 className="text-lg font-bold text-amber-900">ขอเบิกเงินสำรองล่วงหน้า</h2>
      </div>
      <p className="mb-4 text-sm text-amber-800">
        หน้านี้ใช้สำหรับขอเบิกเงินสำรองเท่านั้น — ไม่เกี่ยวข้องกับยอด COD ของลูกค้า
      </p>

      {successRequestNo && (
        <div className="mb-4 rounded-lg bg-green-100 p-3 text-sm text-green-800">
          ส่งคำขอสำเร็จ เลขที่คำขอ: <strong>{successRequestNo}</strong> รอการอนุมัติจากแอดมิน
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="amount" className="mb-1 block text-sm font-medium text-amber-900">
            จำนวนเงิน (บาท)
          </label>
          <input
            id="amount"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-amber-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="เช่น 1500"
          />
          {fieldErrors.amount?.map((msg) => (
            <p key={msg} className="mt-1 text-xs text-red-600">{msg}</p>
          ))}
        </div>

        <div>
          <label htmlFor="reason" className="mb-1 block text-sm font-medium text-amber-900">
            เหตุผล
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-amber-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="เช่น ค่าน้ำมันฉุกเฉินระหว่างส่งงาน"
          />
          {fieldErrors.reason?.map((msg) => (
            <p key={msg} className="mt-1 text-xs text-red-600">{msg}</p>
          ))}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
        >
          {isSubmitting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอเบิกเงินสำรอง'}
        </button>
      </form>
    </div>
  );
}
