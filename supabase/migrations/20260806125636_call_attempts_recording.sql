-- =====================================================================
-- Recording capture for real (non-mock) providers.
--
-- The mock provider seals a recording via `voc_recordings.storage_path`
-- (an internal Storage object key), populated only for a *delivery*-
-- confirmation call. A real provider's order-confirmation call recording
-- (e.g. Exotel's `RecordingUrl`, captured asynchronously via its
-- StatusCallback, well after this row is first written) is a bare external
-- URL, not something we control the storage path of — hence a separate
-- column here rather than overloading voc_recordings' meaning.
-- `provider_call_ref` is the provider's own call id (Exotel CallSid), kept
-- alongside for cross-referencing against provider-side logs/support.
-- =====================================================================

alter table call_attempts add column if not exists recording_url text;
alter table call_attempts add column if not exists provider_call_ref text;

create index if not exists call_attempts_provider_call_ref_idx
  on call_attempts (provider_call_ref);

-- Applying DDL directly (psql) does not refresh PostgREST's schema cache, so
-- supabase-js can briefly fail with PGRST204 ("column ... not in schema
-- cache"). Tell PostgREST to reload immediately (same fix already in use
-- elsewhere in this project's migrations).
notify pgrst, 'reload schema';
