import { z } from 'zod';
import { normalizePhone } from './phone';

/**
 * mjunction import columns (base brief Appendix C). Order file has no delivery
 * date; the delivery file adds "Product Delivery Date".
 */
export const IMPORT_COLUMNS = [
  'Calling From',
  'Tele Caller name',
  'Contact No',
  'Customer Name',
  'Address',
  'Product Name',
  'Product Delivery Date',
] as const;

const HEADER_ALIASES: Record<string, string> = {
  'calling from': 'calling_from',
  'tele caller name': 'telecaller_name',
  'telecaller name': 'telecaller_name',
  'contact no': 'contact_no',
  'contact number': 'contact_no',
  'phone': 'contact_no',
  'customer name': 'customer_name',
  'name': 'customer_name',
  'address': 'address',
  'product name': 'product_name',
  'product': 'product_name',
  'product delivery date': 'product_delivery_date',
  'delivery date': 'product_delivery_date',
};

export type RawRow = Record<string, unknown>;

export interface MappedRow {
  calling_from: string | null;
  telecaller_name: string | null;
  contact_no: string | null;
  contact_no_e164: string | null;
  customer_name: string | null;
  address: string | null;
  product_name: string | null;
  product_delivery_date: string | null;
}

export interface ValidatedRow extends MappedRow {
  rowIndex: number;
  missing_address: boolean;
  missing_product: boolean;
  phone_valid: boolean;
  is_duplicate: boolean;
  errors: string[];
}

export interface ImportPreview {
  rows: ValidatedRow[];
  rowCount: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Excel serial or free-text date -> ISO date (yyyy-mm-dd) or null. */
function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    // Excel serial date (days since 1899-12-30).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
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
    calling_from: str(mapped.calling_from),
    telecaller_name: str(mapped.telecaller_name),
    contact_no: phone.raw || str(mapped.contact_no),
    contact_no_e164: phone.e164,
    customer_name: str(mapped.customer_name),
    address: str(mapped.address),
    product_name: str(mapped.product_name),
    product_delivery_date: parseDate(mapped.product_delivery_date),
  };
}

export const rowSchema = z.object({
  contact_no: z.string().min(1, 'Contact number required'),
  customer_name: z.string().min(1, 'Customer name required'),
});

/**
 * Validate raw rows into a preview: normalises phones, flags missing
 * address/product, detects in-file duplicates (by E.164). `existingE164`
 * marks rows that collide with recipients already in the campaign.
 */
export function validateRows(
  rawRows: RawRow[],
  existingE164: Set<string> = new Set(),
): ImportPreview {
  const seen = new Set<string>(existingE164);
  const rows: ValidatedRow[] = [];
  let validCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;

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

    let is_duplicate = false;
    if (mapped.contact_no_e164) {
      if (seen.has(mapped.contact_no_e164)) {
        is_duplicate = true;
        duplicateCount++;
      } else {
        seen.add(mapped.contact_no_e164);
      }
    }

    const hasError = errors.length > 0;
    if (hasError) errorCount++;
    else if (!is_duplicate) validCount++;

    rows.push({
      ...mapped,
      rowIndex: i + 1,
      missing_address,
      missing_product,
      phone_valid,
      is_duplicate,
      errors,
    });
  });

  return {
    rows,
    rowCount: rawRows.length,
    validCount,
    errorCount,
    duplicateCount,
  };
}
