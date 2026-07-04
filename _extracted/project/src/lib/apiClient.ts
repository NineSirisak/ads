'use client';

/**
 * Shared fetch wrapper — ใส่ Authorization header อัตโนมัติ + จัดการ error format เดียวกันทุกจุด
 * ป้องกันการเขียน fetch ซ้ำๆ ในทุก component (DRY) และรับประกันว่า error message ที่โยนออกไป
 * มาจาก field เดียวกันเสมอ (`error`) ตาม convention ของ API route ที่ทำไว้ในเฟส backend
 */

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(body?.error ?? `เกิดข้อผิดพลาด (HTTP ${response.status})`, response.status, body?.details);
  }

  return body as T;
}
