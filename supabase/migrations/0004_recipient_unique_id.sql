-- ===================================================================
-- Recipients get a stable external "unique id".
--   * Supplied by the import file when present.
--   * Auto-generated (uuid) otherwise, via the column default.
-- Used to match rows on bulk dispatch / delivery updates.
-- ===================================================================

alter table recipients add column if not exists unique_id text;

-- Backfill existing rows so the column can be NOT NULL.
update recipients set unique_id = gen_random_uuid()::text where unique_id is null;

-- Future inserts without an explicit id get one automatically.
alter table recipients alter column unique_id set default gen_random_uuid()::text;
alter table recipients alter column unique_id set not null;

-- Fetch-by-id must resolve a single record.
create unique index if not exists recipients_unique_id_uidx on recipients (unique_id);
