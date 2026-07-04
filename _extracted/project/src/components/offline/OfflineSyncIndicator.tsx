'use client';

import { useEffect, useState, useCallback } from 'react';
import type { OfflineSyncQueue } from '@/lib/offlineSync/queue';

interface OfflineSyncIndicatorProps {
  queue: OfflineSyncQueue;
  syncFn: Parameters<OfflineSyncQueue['syncAll']>[0];
  pollIntervalMs?: number;
}

/**
 * แสดง indicator บนหน้าหลักของ Driver PWA เสมอ (ไม่ซ่อน)
 * ตามที่ design ระบุไว้: "ต้องมี UI indicator ชัดเจนว่ามี X รายการรอ sync ค้างอยู่บนหน้าหลักเสมอ ไม่ซ่อนไว้"
 */
export function OfflineSyncIndicator({
  queue,
  syncFn,
  pollIntervalMs = 5000,
}: OfflineSyncIndicatorProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stuckCount, setStuckCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const count = await queue.getPendingCount();
    const stuck = await queue.getStuckActions();
    setPendingCount(count);
    setStuckCount(stuck.length);
  }, [queue]);

  const trySync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      await queue.syncAll(syncFn);
    } finally {
      setIsSyncing(false);
      await refreshCount();
    }
  }, [queue, syncFn, isSyncing, refreshCount]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      trySync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
      refreshCount();
      if (navigator.onLine) trySync();
    }, pollIntervalMs);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pendingCount === 0 && isOnline) return null; // ไม่มีอะไรค้าง + online ปกติ ไม่ต้องแสดง

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
        !isOnline
          ? 'bg-gray-700 text-white'
          : stuckCount > 0
          ? 'bg-red-100 text-red-800'
          : 'bg-yellow-100 text-yellow-800'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
      {!isOnline && <span>ออฟไลน์ — ข้อมูลจะ sync อัตโนมัติเมื่อมีสัญญาณ</span>}
      {isOnline && stuckCount > 0 && (
        <span>⚠️ มี {stuckCount} รายการ sync ไม่สำเร็จหลายครั้ง — กรุณาตรวจสอบกับแอดมิน</span>
      )}
      {isOnline && stuckCount === 0 && pendingCount > 0 && (
        <span>{isSyncing ? 'กำลัง sync...' : `รอ sync ${pendingCount} รายการ`}</span>
      )}
    </div>
  );
}
