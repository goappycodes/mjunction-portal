import { parseSpreadsheetDate } from './dates';

/**
 * Bulk "mark as delivered" import columns. A courier/ops delivery feed:
 * one row per shipment, keyed by the recipient's Order Item ID — the same
 * id used by the recipient import (see IMPORT_COLUMNS in lib/domain/import.ts).
 */
export const BULK_DELIVERY_COLUMNS = ['Order Item ID', 'Delivery Status', 'Delivery Date'] as const;

const HEADER_ALIASES: Record<string, string> = {
  'order item id': 'unique_id',
  // Older feeds/templates called this column something else — still accepted.
  'unique order id': 'unique_id',
  'unique id': 'unique_id',
  'order id': 'unique_id',
  'order_id': 'unique_id',
  'delivery status': 'delivery_status',
  'status': 'delivery_status',
  'delivery date': 'delivered_date',
  'delivered date': 'delivered_date',
  'date': 'delivered_date',
};

export type RawRow = Record<string, unknown>;

export interface MappedDeliveryRow {
  unique_id: string | null;
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
  return {
    unique_id: str(mapped.unique_id),
    delivery_status_raw: str(mapped.delivery_status),
    delivered_date: parseSpreadsheetDate(mapped.delivered_date),
  };
}

/**
 * Format-level validation only (unique id/date/status present and
 * parseable) — no DB access, mirrors validateRows() in
 * lib/domain/import.ts. Matching a row to a recipient (and whether that
 * recipient is actually dispatched) happens server-side against the DB,
 * since it needs the DB.
 */
export function validateDeliveryRows(rawRows: RawRow[]): DeliveryPreview {
  const rows: ValidatedDeliveryRow[] = [];
  let validCount = 0;
  let errorCount = 0;

  rawRows.forEach((raw, i) => {
    const mapped = mapDeliveryRow(raw);
    const errors: string[] = [];

    if (!mapped.unique_id) errors.push('Order Item ID required');
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
