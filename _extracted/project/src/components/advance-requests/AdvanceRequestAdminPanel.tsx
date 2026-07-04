'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/apiClient';
import type { AdvanceRequest } from '@/types';

interface AdvanceRequestAdminPanelProps {
  accessToken: string;
}

/**
 * หน้า Admin สำหรับดูและอนุมัติคำขอเบิกเงินสำรอง
 * ตามสเปคจุดที่ 4.1: ต้องแยกหน้าต่างนี้ออกจากหน้าจัดการ COD อย่างเด็ดขาด
 * -> ใช้ path/URL แยก (`/admin/finance/advance-requests`) และธีมสีต่างกันชัดเจน (ส้ม vs เขียว/น้ำเงินของ COD)
 */
export function AdvanceRequestAdminPanel({ accessToken }: AdvanceRequestAdminPanelProps) {
  const [requests, setRequests] = useState<AdvanceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AdvanceRequest[]>(
        '/api/advance-requests?status=pending',
        accessToken
      );
      setRequests(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  async function handleDecision(approvalId: string | null | undefined, decision: 'approved' | 'rejected') {
    if (!approvalId) {
      setError('ไม่พบ approval_id สำหรับคำขอนี้ — ข้อมูลอาจไม่สมบูรณ์ กรุณาติดต่อทีมพัฒนา');
      return;
    }
    setProcessingId(approvalId);
    setError(null);
    try {
      await apiFetch(`/api/approvals/${approvalId}/decide`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      await loadPending();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-900">คำขอเบิกเงินสำรอง (รออนุมัติ)</h2>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
          {requests.length} รายการ
        </span>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</div>}

      {isLoading ? (
        <p className="text-sm text-gray-500">กำลังโหลด...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-gray-500">ไม่มีคำขอที่รออนุมัติ</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li key={req.id} className="rounded-lg border border-gray-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm text-gray-600">{req.request_no}</span>
                <span className="font-bold text-amber-700">{req.amount.toLocaleString()} บาท</span>
              </div>
              <p className="mb-3 text-sm text-gray-700">{req.reason}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDecision(req.approval_id, 'approved')}
                  disabled={processingId === req.approval_id}
                  className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  อนุมัติ
                </button>
                <button
                  onClick={() => handleDecision(req.approval_id, 'rejected')}
                  disabled={processingId === req.approval_id}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  ปฏิเสธ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
