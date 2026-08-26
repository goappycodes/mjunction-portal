-- =====================================================================
-- Remove campaigns table and all relationships.
--
-- Add company_name to recipients (replaces campaign.calling_from branding).
-- Make unique_id globally unique (was unique per-campaign).
-- Drop campaign_id FKs and columns from all tables.
-- Drop the campaigns table itself.
-- =====================================================================

-- 1. Add company_name to recipients.
alter table recipients add column if not exists company_name text;

-- 2. Swap the per-campaign unique_id index for a global one.
drop index if exists recipients_campaign_unique_id_uidx;
create unique index if not exists recipients_unique_id_uidx on recipients (unique_id);

-- 3. Drop campaign_id from recipients (NOT NULL with FK — drop the constraint first).
alter table recipients drop column if exists campaign_id;

-- 4. Drop calling_from from recipients (was copied from campaign at import time;
--    company_name is the replacement).
alter table recipients drop column if exists calling_from;

-- 5. call_attempts.campaign_id
alter table call_attempts drop column if exists campaign_id;

-- 6. voc_recordings.campaign_id
alter table voc_recordings drop column if exists campaign_id;

-- 7. import_batches.campaign_id
alter table import_batches drop column if exists campaign_id;

-- 8. Drop campaigns table (recipients no longer references it).
drop table if exists campaigns cascade;

notify pgrst, 'reload schema';
