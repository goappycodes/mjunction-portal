import { z } from 'zod';
import { normalizePhone } from './phone';
import { parseDayFirstDate } from './dates';

/**
 * Recipient import columns, matching mjunction's "Purchase Order" export
 * verbatim (including its "Recipent Name" header typo, kept as an alias
 * below). One row per dispatch line item.
 */
export const IMPORT_COLUMNS = [
  'Vendor Dispatch Id',
  'Vendor PO Number',
  'Order ID',
  'Order Item ID',
  'Order Date',
  'Product Name',
  'Recipent Name',
  'Ordered Quantity',
  'Dispatch Quantity',
  'Address',
  'Phone No.',
  'Email Id',
  'Courier Name',
] as const;

const HEADER_ALIASES: Record<string, string> = {
  'vendor dispatch id': 'vendor_dispatch_id',
  'vendor po number': 'vendor_po_number',
  'order id': 'order_id',
  'order item id': 'unique_id',
  'unique order id': 'unique_id',
  'unique id': 'unique_id',
  'order date': 'order_date',
  'product name': 'product_name',
  'product': 'product_name',
  'recipent name': 'customer_name',
  'recipient name': 'customer_name',
  'customer name': 'customer_name',
  'name': 'customer_name',
  'ordered quantity': 'ordered_quantity',
  'dispatch quantity': 'dispatch_quantity',
  'address': 'address',
  'phone no.': 'contact_no',
  'phone no': 'contact_no',
  'contact no': 'contact_no',
  'contact number': 'contact_no',
  'phone': 'contact_no',
  'email id': 'email',
  'email': 'email',
  'courier name': 'courier_name',
  'courier': 'courier_name',
};

export type RawRow = Record<string, unknown>;

export interface MappedRow {
  unique_id: string | null;
  order_id: string | null;
  vendor_po_number: string | null;
  vendor_dispatch_id: string | null;
  order_date: string | null;
  contact_no: string | null;
  contact_no_e164: string | null;
  email: string | null;
  customer_name: string | null;
  address: string | null;
  product_name: string | null;
  ordered_quantity: number | null;
  dispatch_quantity: number | null;
  courier_name: string | null;
}

export interface ValidatedRow extends MappedRow {
  rowIndex: number;
  missing_address: boolean;
  missing_product: boolean;
  phone_valid: boolean;
  is_duplicate_unique_id: boolean;
  errors: string[];
}

export interface ImportPreview {
  rows: ValidatedRow[];
  rowCount: number;
  validCount: number;
  errorCount: number;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Normalise arbitrary header casing/whitespace to canonical field keys. */
export function mapHeaders(row: RawRow): RawRow {
  const out: RawRow = {};
  for (const [key, value] of Object.entries(row)) {
    const canonical = HEADER_ALIASES[key.trim().toLowerCase()];
    if (canonical) out[canonical] = value;
  }
  return out;
}

export function mapRow(raw: RawRow): MappedRow {
  const mapped = mapHeaders(raw);
  const phone = normalizePhone(str(mapped.contact_no));
  return {
    unique_id: str(mapped.unique_id),
    order_id: str(mapped.order_id),
    vendor_po_number: str(mapped.vendor_po_number),
    vendor_dispatch_id: str(mapped.vendor_dispatch_id),
    order_date: parseDayFirstDate(mapped.order_date),
    contact_no: phone.raw || str(mapped.contact_no),
    contact_no_e164: phone.e164,
    email: str(mapped.email),
    customer_name: str(mapped.customer_name),
    address: str(mapped.address),
    product_name: str(mapped.product_name),
    ordered_quantity: num(mapped.ordered_quantity),
    dispatch_quantity: num(mapped.dispatch_quantity),
    courier_name: str(mapped.courier_name),
  };
}

export const rowSchema = z.object({
  unique_id: z.string().min(1, 'Order Item ID required'),
  contact_no: z.string().min(1, 'Phone No. required'),
  customer_name: z.string().min(1, 'Recipent Name required'),
});

/**
 * Validate raw rows into a preview: normalises phones, flags missing
 * address/product, detects duplicate Order Item IDs. `existingUniqueIds`
 * marks rows that collide with existing recipients. Phone numbers are not
 * deduped — the same number can legitimately recur across orders/recipients.
 */
export function validateRows(
  rawRows: RawRow[],
  existingUniqueIds: Set<string> = new Set(),
): ImportPreview {
  const seenUniqueIds = new Set<string>(existingUniqueIds);
  const rows: ValidatedRow[] = [];
  let validCount = 0;
  let errorCount = 0;

  rawRows.forEach((raw, i) => {
    const mapped = mapRow(raw);
    const errors: string[] = [];

    const parsed = rowSchema.safeParse(mapped);
    if (!parsed.success) {
      errors.push(...parsed.error.issues.map((e) => e.message));
    }

    const phone_valid = !!mapped.contact_no_e164;
    if (!phone_valid) errors.push('Invalid phone number');

    const missing_address = !mapped.address;
    const missing_product = !mapped.product_name;

    let is_duplicate_unique_id = false;
    if (mapped.unique_id) {
      if (seenUniqueIds.has(mapped.unique_id)) {
        is_duplicate_unique_id = true;
        errors.push('Duplicate Order Item ID');
      } else {
        seenUniqueIds.add(mapped.unique_id);
      }
    }

    const hasError = errors.length > 0;
    if (hasError) errorCount++;
    else validCount++;

    rows.push({
      ...mapped,
      rowIndex: i + 1,
      missing_address,
      missing_product,
      phone_valid,
      is_duplicate_unique_id,
      errors,
    });
  });

  return {
    rows,
    rowCount: rawRows.length,
    validCount,
    errorCount,
  };
}
