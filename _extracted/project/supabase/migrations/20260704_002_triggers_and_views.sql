-- ============================================================
-- Migration 002 — RPC functions, triggers, materialized views
-- ============================================================

-- ------------------------------------------------------------
-- 1. Atomic ticket/request sequence generator
--    ใช้ตารางกลาง ticket_sequences เพื่อป้องกัน race condition
-- ------------------------------------------------------------
create table if not exists ticket_sequences (
  prefix text not null,
  seq_date date not null,
  last_sequence integer not null default 0,
  primary key (prefix, seq_date)
);

create or replace function next_ticket_sequence(p_prefix text, p_date date)
returns integer as $$
declare
  v_seq integer;
begin
  insert into ticket_sequences (prefix, seq_date, last_sequence)
  values (p_prefix, p_date, 1)
  on conflict (prefix, seq_date)
  do update set last_sequence = ticket_sequences.last_sequence + 1
  returning last_sequence into v_seq;

  if v_seq > 9999 then
    raise exception 'เลขที่ % สำหรับวันที่ % เกิน 9999 รายการต่อวันแล้ว', p_prefix, p_date;
  end if;

  return v_seq;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 2. After-hours anomaly trigger (จุดที่ 5.2 ของสเปค)
--    ผูกกับตารางเสี่ยง: cod_transactions, checkins, advance_requests
-- ------------------------------------------------------------
create or replace function flag_after_hours_activity()
returns trigger as $$
declare
  v_bangkok_hour integer;
begin
  -- ข้ามถ้าเป็น service role / cron (auth.uid() is null)
  if auth.uid() is null then
    return NEW;
  end if;

  v_bangkok_hour := extract(hour from (now() at time zone 'Asia/Bangkok'));

  if v_bangkok_hour >= 20 or v_bangkok_hour < 6 then
    insert into activity_logs (actor_id, event_type, message, metadata)
    values (
      auth.uid(),
      'after_hours_activity',
      'พบการอัปเดตข้อมูลนอกเวลางาน',
      jsonb_build_object('table', TG_TABLE_NAME, 'row_id', NEW.id)
    );

    insert into notification_log (channel, target, payload)
    values (
      'line',
      'admin_group',
      jsonb_build_object(
        'text', '⚠️ พบการอัปเดตข้อมูลผิดปกติหลัง 20:00 น. ในตาราง ' || TG_TABLE_NAME
      )
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_after_hours_cod on cod_transactions;
create trigger trg_after_hours_cod
  after insert or update on cod_transactions
  for each row execute function flag_after_hours_activity();

drop trigger if exists trg_after_hours_advance on advance_requests;
create trigger trg_after_hours_advance
  after insert or update on advance_requests
  for each row execute function flag_after_hours_activity();

-- ------------------------------------------------------------
-- 3. Materialized view สำหรับ SuperAdmin Analytics + Report Engine
-- ------------------------------------------------------------
create materialized view if not exists mv_daily_revenue_summary as
select
  date_trunc('day', created_at)::date as day,
  courier_brand,
  sum(net_revenue) as total_net_revenue,
  sum(commission_amount) as total_commission,
  sum(advance_deducted) as total_advance_deducted,
  count(*) as total_jobs
from checkout_tickets
group by 1, 2;

create unique index if not exists idx_mv_daily_revenue_day_brand
  on mv_daily_revenue_summary (day, courier_brand);

create or replace function refresh_daily_revenue_summary()
returns void as $$
begin
  refresh materialized view concurrently mv_daily_revenue_summary;
end;
$$ language plpgsql;

-- รีเฟรชทุก 1 ชั่วโมง (ต้องมี pg_cron extension เปิดใช้งานแล้ว)
select cron.schedule(
  'refresh-daily-revenue-summary',
  '0 * * * *',
  $$ select refresh_daily_revenue_summary(); $$
);

-- ------------------------------------------------------------
-- 4. RPC: fraud rate by month (สำหรับ SuperAdmin analytics fraud-rate endpoint)
-- ------------------------------------------------------------
create or replace function get_fraud_rate_by_month(p_months integer)
returns table (
  month text,
  verified_count bigint,
  flagged_fraud_count bigint,
  pending_review_count bigint
) as $$
begin
  return query
  select
    to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
    count(*) filter (where ocr_decision = 'verified') as verified_count,
    count(*) filter (where ocr_decision = 'flagged_fraud') as flagged_fraud_count,
    count(*) filter (where ocr_decision = 'pending_admin_review') as pending_review_count
  from ocr_results
  where created_at >= now() - (p_months || ' months')::interval
  group by 1
  order by 1;
end;
$$ language plpgsql stable;
