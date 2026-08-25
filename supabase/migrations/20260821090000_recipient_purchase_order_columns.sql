-- =====================================================================
-- Recipient import now comes from mjunction's "Purchase Order" export
-- (Vendor Dispatch Id, Vendor PO Number, Order ID, Order Item ID, Order
-- Date, Product Name, Recipent Name, Ordered/Dispatch Quantity, Address,
-- Phone No., Email Id, Courier Name) instead of the old ad-hoc IVR sheet.
-- unique_id now holds Order Item ID (see lib/domain/import.ts); these are
-- the columns from that file with no existing home on recipients.
-- =====================================================================

alter table recipients
  add column if not exists order_id           text,
  add column if not exists vendor_po_number    text,
  add column if not exists vendor_dispatch_id  text,
  add column if not exists order_date          date,
  add column if not exists ordered_quantity    int,
  add column if not exists dispatch_quantity   int,
  add column if not exists email               text,
  add column if not exists courier_name        text;

create index if not exists recipients_order_id_idx on recipients (order_id);

notify pgrst, 'reload schema';
