-- =====================================================================
-- Migration 0005: telecaller_name on call_records, to power the VOC &
-- Reports "Telecaller" filter without a live join back to recipients.
-- =====================================================================

alter table call_records add column telecaller_name text;
