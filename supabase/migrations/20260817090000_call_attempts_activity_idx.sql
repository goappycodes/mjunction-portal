-- Daily activity on the dashboard (getDailyActivity in src/lib/domain/metrics.ts)
-- scans call_attempts by created_at over a rolling window, optionally narrowed
-- to one campaign. The existing indexes are on (recipient_id, call_type) and
-- provider_call_ref, neither of which helps that access pattern — it would
-- otherwise be a sequential scan on every dashboard load, growing with the
-- table.
--
-- campaign_id leads the index because the campaign-scoped view is the selective
-- case; the unscoped "all campaigns" query still uses it for the created_at
-- range via a scan over the leading column, which is no worse than today.
create index if not exists call_attempts_campaign_created_idx
  on call_attempts (campaign_id, created_at desc);
