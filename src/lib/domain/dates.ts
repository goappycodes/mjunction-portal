/** Excel serial date or free-text date -> ISO date (yyyy-mm-dd), or null. */
export function parseSpreadsheetDate(v: unknown): string | null {
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

/**
 * "DD/MM/YYYY[ HH:MM:SS]" (or an Excel serial date) -> ISO date, or null.
 * The mjunction Purchase Order export writes day-first timestamps (e.g.
 * "04/08/2026 12:08:13"); plain `new Date(...)` parses slash dates
 * month-first and would silently swap day/month.
 */
export function parseDayFirstDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return parseSpreadsheetDate(v);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return parseSpreadsheetDate(v);
}
