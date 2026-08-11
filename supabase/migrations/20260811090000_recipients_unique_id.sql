-- =====================================================================
-- Canonical order id: `recipients.unique_id`.
--
-- One recipient IS one order (per the ops/import brief), and every external
-- boundary that needs to reference a specific order — the import template,
-- the bulk-delivery matching file, the IVR engine's order lookup, and the
-- VOC/Reports export — should key off a single importer-provided id rather
-- than the internal `id` uuid or the (ambiguous across campaigns) phone
-- number. Existing rows are backfilled from their own `id` so the column can
-- be NOT NULL from here on; every future insert (import) must supply one.
-- =====================================================================

alter table recipients add column if not exists unique_id text;
update recipients set unique_id = id::text where unique_id is null;
alter table recipients alter column unique_id set not null;

create unique index if not exists recipients_campaign_unique_id_uidx
  on recipients (campaign_id, unique_id);

alter table call_records add column if not exists unique_id text;
update call_records cr set unique_id = r.unique_id
  from recipients r where r.id = cr.recipient_id and cr.unique_id is null;

notify pgrst, 'reload schema';
