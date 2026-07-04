'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  shouldTakeSample,
  shouldFlushBatch,
  shouldUseHighAccuracy,
  type SamplingState,
} from '@/lib/gps/sampling';
import { apiFetch } from '@/lib/apiClient';
import type { GpsPing } from '@/types';

interface UseGpsTrackingOptions {
  accessToken: string;
  jobId: string | null; // null = ไม่มีงาน active -> ไม่ track
  onError?: (message: string) => void;
}

/**
 * Hook ติดตามตำแหน่ง GPS ต่อเนื่องระหว่างมีงาน active
 * - แจ้ง consent ต้องทำที่ UI ชั้นบน (แสดง indicator ว่ากำลัง track) ก่อน mount hook นี้
 * - ใช้ watchPosition + sampling logic แยกเป็น pure function เพื่อทดสอบได้
 */
export function useGpsTracking({ accessToken, jobId, onError }: UseGpsTrackingOptions) {
  const [isTracking, setIsTracking] = useState(false);
  const bufferRef = useRef<GpsPing[]>([]);
  const stateRef = useRef<SamplingState>({
    hasActiveJob: false,
    lastSampleAtMs: null,
    bufferedPingCount: 0,
    lastBatchSentAtMs: null,
  });
  const watchIdRef = useRef<number | null>(null);

  const flushBuffer = useCallback(async () => {
    if (bufferRef.current.length === 0) return;
    const pings = bufferRef.current;
    bufferRef.current = [];
    stateRef.current.bufferedPingCount = 0;
    stateRef.current.lastBatchSentAtMs = Date.now();

    try {
      await apiFetch('/api/gps/batch', accessToken, {
        method: 'POST',
        body: JSON.stringify({ pings }),
      });
    } catch (err) {
      // ถ้าส่งไม่สำเร็จ ใส่กลับเข้า buffer เพื่อรอบถัดไป (ไม่ทิ้งข้อมูลตำแหน่ง)
      bufferRef.current = [...pings, ...bufferRef.current];
      stateRef.current.bufferedPingCount = bufferRef.current.length;
      onError?.(err instanceof Error ? err.message : 'ส่งข้อมูล GPS ไม่สำเร็จ');
    }
  }, [accessToken, onError]);

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const now = Date.now();
      if (!shouldTakeSample(stateRef.current, now)) return;

      stateRef.current.lastSampleAtMs = now;
      bufferRef.current.push({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
        captured_at: new Date(now).toISOString(),
        job_id: jobId ?? undefined,
      });
      stateRef.current.bufferedPingCount = bufferRef.current.length;

      if (shouldFlushBatch(stateRef.current, now)) {
        flushBuffer();
      }
    },
    [jobId, flushBuffer]
  );

  useEffect(() => {
    stateRef.current.hasActiveJob = jobId !== null;

    if (!jobId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      return;
    }

    if (!('geolocation' in navigator)) {
      onError?.('อุปกรณ์นี้ไม่รองรับ GPS');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => onError?.(`ไม่สามารถอ่านตำแหน่ง GPS ได้: ${err.message}`),
      { enableHighAccuracy: shouldUseHighAccuracy('routine'), maximumAge: 30_000 }
    );
    setIsTracking(true);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [jobId, handlePosition, onError]);

  // flush buffer ที่เหลือตอน unmount เพื่อไม่ทิ้งข้อมูล
  useEffect(() => {
    return () => {
      flushBuffer();
    };
  }, [flushBuffer]);

  return { isTracking, pendingPingCount: bufferRef.current.length };
}
