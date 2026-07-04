'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { apiFetch, ApiError } from '@/lib/apiClient';
import type { RevenueSummaryRow } from '@/types';

interface SuperAdminAnalyticsDashboardProps {
  accessToken: string;
}

interface FraudTrendPoint {
  month: string;
  fraudRatePercent: number;
}

/**
 * Dashboard เชิงกลยุทธ์สำหรับ SuperAdmin — แยกจาก Admin Command Center (operational)
 * ดู docs/01_design_docs/01_architecture/superadmin_analytics_design.md
 */
export function SuperAdminAnalyticsDashboard({ accessToken }: SuperAdminAnalyticsDashboardProps) {
  const [revenueRows, setRevenueRows] = useState<RevenueSummaryRow[]>([]);
  const [fraudTrend, setFraudTrend] = useState<FraudTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setIsLoading(true);
      setError(null);
      try {
        const [revenue, fraud] = await Promise.all([
          apiFetch<{ rows: RevenueSummaryRow[] }>('/api/superadmin/analytics/revenue?range=30d', accessToken),
          apiFetch<{ trend: FraudTrendPoint[] }>('/api/superadmin/analytics/fraud-rate?range=90d', accessToken),
        ]);
        if (!cancelled) {
          setRevenueRows(revenue.rows);
          setFraudTrend(fraud.trend);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'โหลดข้อมูล Analytics ไม่สำเร็จ');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (isLoading) return <p className="text-sm text-gray-500">กำลังโหลดข้อมูล Analytics...</p>;
  if (error) return <div className="rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-lg font-bold text-gray-900">รายได้สุทธิรายวัน (30 วันล่าสุด) ต่อบริษัทขนส่ง</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => `${value.toLocaleString()} บาท`} />
            <Legend />
            <Bar dataKey="total_net_revenue" name="รายได้สุทธิ" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-lg font-bold text-gray-900">แนวโน้มอัตราการตรวจพบทุจริต (90 วันล่าสุด)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={fraudTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" />
            <Tooltip formatter={(value: number) => `${value}%`} />
            <Legend />
            <Line type="monotone" dataKey="fraudRatePercent" name="อัตราทุจริต (%)" stroke="#dc2626" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
