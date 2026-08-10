-- =====================================================================
-- Migration 0004: call_records — one row per recipient, the single
-- source the VOC & Reports page reads from. Kept up to date by
-- upsertCallRecord() (lib/domain/call-records.ts), called from every
-- mutation site (import, calls, dispatch, agent actions, seed).
-- =====================================================================

create table call_records (
  id                     uuid primary key default gen_random_uuid(),
  recipient_id           uuid not null unique references recipients(id) on delete cascade,
  campaign_id            uuid not null references campaigns(id) on delete cascade,
  customer_name          text,
  contact_no_e164        text,
  product_name           text,
  status                 recipient_status not null,
  language               text references languages(code),
  order_confirmed_at     timestamptz,
  dispatched_date        date,
  delivered_date         date,
  delivery_confirmed_at  timestamptz,
  sealed_voc_id          text,
  voc_recording_id       uuid references voc_recordings(id),
  dtmf_outcome           text,
  duration_seconds       int,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index call_records_campaign_idx on call_records (campaign_id);

alter table call_records enable row level security;

create policy call_records_read on call_records for select to authenticated using (true);
create policy call_records_admin_write on call_records for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- telecaller-driven agent actions (resolveOrderEscalation/resolveDeliveryIssue) keep
-- call_records in sync too via the same upsertCallRecord() helper.
create policy call_records_telecaller_insert on call_records for insert to authenticated
  with check (public.current_app_role() = 'telecaller');
create policy call_records_telecaller_update on call_records for update to authenticated
  using (public.current_app_role() = 'telecaller')
  with check (public.current_app_role() = 'telecaller');
