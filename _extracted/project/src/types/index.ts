// CKTONLINE — Shared types for gap-closure modules
// Clean, single source of truth used by both API routes and business logic

export type AdvanceRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'settled';

export interface AdvanceRequest {
  id: string;
  request_no: string; // ADV + YYYYMMDD + 4-digit sequence
  driver_id: string;
  amount: number;
  reason: string;
  status: AdvanceRequestStatus;
  requested_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  disbursed_at?: string | null;
  settled_at?: string | null;
  notes?: string | null;
  approval_id?: string | null; // ผูกกับ approvals table (polymorphic) — ใช้เรียก /api/approvals/:id/decide
}

export type ApprovalEntityType = 'cod_transaction' | 'advance_request';
export type ApprovalDecision = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  requested_by?: string | null;
  reviewed_by?: string | null;
  decision: ApprovalDecision;
  decision_reason?: string | null;
  created_at: string;
  decided_at?: string | null;
}

export interface GpsPing {
  lat: number;
  lng: number;
  accuracy_m?: number;
  captured_at: string; // ISO 8601
  job_id?: string;
  synced_offline?: boolean;
}

export type NotificationChannel = 'line' | 'email' | 'web_push';
export type NotificationStatus = 'queued' | 'sent' | 'failed';

export interface NotificationLogEntry {
  id: string;
  channel: NotificationChannel;
  target: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  error?: string | null;
  created_at: string;
  sent_at?: string | null;
}

export type FraudAlertSeverity = 'info' | 'warning' | 'critical';

export interface AfterHoursActivityEvent {
  tableName: string;
  rowId: string;
  actorId: string | null; // null = service role / system, should never alert
  occurredAtUtc: string; // ISO 8601 UTC
  amount?: number; // relevant for warning/critical threshold
}

export interface RevenueSummaryRow {
  day: string;
  courier_brand: string;
  total_net_revenue: number;
  total_jobs: number;
}

export interface SettlementResult {
  netRevenueAfterAdvance: number;
  advanceDeducted: number;
  remainingOutstanding: number;
}

export type ReportFormat = 'pdf' | 'xlsx' | 'csv';

export interface DailySummaryReportRow {
  courierBrand: string;
  totalJobs: number;
  totalNetRevenue: number;
  totalCommission: number;
  totalAdvanceDeducted: number;
}
