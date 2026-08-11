-- =====================================================================
-- VOC & Reports becomes a per-call log instead of a per-recipient rollup.
--
-- `call_records` had a hard `recipient_id unique` constraint, so it could
-- only ever show one row per recipient — structurally unable to show call
-- retries. Nothing else in the app reads it (confirmed by search), so it's
-- retired outright rather than kept alongside a new table.
--
-- `provider_status` captures Exotel's raw telephony status (queued, ringing,
-- completed, no-answer, busy, failed, ...) at the two points the IVR engine
-- actually knows it (dial time, and the terminal StatusCallback) — nothing
-- persisted this anywhere queryable before; it only ever reached the IVR
-- engine's own ivr_logs/ivr_call_events trace tables, which mjunction can't
-- read (service-role-only grants) and which mix provider status with
-- app-step status as inconsistent free text.
-- =====================================================================

alter table call_attempts add column if not exists provider_status text;
drop table if exists call_records;

notify pgrst, 'reload schema';
