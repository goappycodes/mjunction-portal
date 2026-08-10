import { normalizePhone } from './phone';
import { parseSpreadsheetDate } from './dates';

/**
 * Bulk "mark as delivered" import columns. A courier/ops delivery feed:
 * one row per shipment, keyed by the recipient's contact number.
 */
export const BULK_DELIVERY_COLUMNS = ['Contact No', 'Delivery Status', 'Delivery Date'] as const;

const HEADER_ALIASES: Record<string, string> = {
  'contact no': 'contact_no',
  'contact number': 'contact_no',
  'phone': 'contact_no',
  'delivery status': 'delivery_status',
  'status': 'delivery_status',
  'delivery date': 'delivered_date',
  'delivered date': 'delivered_date',
  'date': 'delivered_date',
};

export type RawRow = Record<string, unknown>;

export interface MappedDeliveryRow {
  contact_no: string | null;
  contact_no_e164: string | null;
  delivery_status_raw: string | null;
  delivered_date: string | null;
}

export interface ValidatedDeliveryRow extends MappedDeliveryRow {
  rowIndex: number;
  isDelivered: boolean;
  errors: string[];
}

export interface DeliveryPreview {
  rows: ValidatedDeliveryRow[];
  rowCount: number;
  validCount: number;
  errorCount: number;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** "Delivered", "delivered", " Delivered " all count; anything else (RTO, Failed, …) does not. */
export function isDeliveredStatus(raw: string | null): boolean {
  return (raw ?? '').trim().toLowerCase() === 'delivered';
}

/** Normalise arbitrary header casing/whitespace to canonical field keys. */
function mapHeaders(row: RawRow): RawRow {
  const out: RawRow = {};
  for (const [key, value] of Object.entries(row)) {
    const canonical = HEADER_ALIASES[key.trim().toLowerCase()];
    if (canonical) out[canonical] = value;
  }
  return out;
}

export function mapDeliveryRow(raw: RawRow): MappedDeliveryRow {
  const mapped = mapHeaders(raw);
  const phone = normalizePhone(str(mapped.contact_no));
  return {
    contact_no: phone.raw || str(mapped.contact_no),
    contact_no_e164: phone.e164,
    delivery_status_raw: str(mapped.delivery_status),
    delivered_date: parseSpreadsheetDate(mapped.delivered_date),
  };
}

/**
 * Format-level validation only (phone/date/status present and parseable) —
 * no DB access, mirrors validateRows() in lib/domain/import.ts. Matching a
 * row to a recipient (and whether that recipient is actually dispatched)
 * happens server-side against the DB, since it needs the campaign's data.
 */
export function validateDeliveryRows(rawRows: RawRow[]): DeliveryPreview {
  const rows: ValidatedDeliveryRow[] = [];
  let validCount = 0;
  let errorCount = 0;

  rawRows.forEach((raw, i) => {
    const mapped = mapDeliveryRow(raw);
    const errors: string[] = [];

    if (!mapped.contact_no_e164) errors.push('Invalid phone number');
    if (!mapped.delivery_status_raw) errors.push('Delivery status required');
    if (!mapped.delivered_date) errors.push('Invalid/missing delivery date');

    if (errors.length) errorCount++;
    else validCount++;

    rows.push({
      ...mapped,
      rowIndex: i + 1,
      isDelivered: isDeliveredStatus(mapped.delivery_status_raw),
      errors,
    });
  });

  return { rows, rowCount: rawRows.length, validCount, errorCount };
}
