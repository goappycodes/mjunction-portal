'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import {
  bulkDispatch,
  bulkDeliver,
  type BulkResult,
  type BulkDispatchRow,
  type BulkDeliverRow,
} from '@/app/actions/dispatch';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

type Kind = 'dispatch' | 'deliver';

const TEMPLATE = {
  dispatch: {
    headers: ['Unique Id', 'Contact No', 'Delivery Partner', 'AWB Number', 'Dispatch Date'],
    sample: {
      'Unique Id': '',
      'Contact No': '9876543210',
      'Delivery Partner': 'Delhivery',
      'AWB Number': '1234567890',
      'Dispatch Date': '2026-07-30',
    },
    sheet: 'Dispatch',
    file: 'dispatch_import_template.xlsx',
  },
  deliver: {
    headers: ['Unique Id', 'Contact No', 'Delivery Date'],
    sample: { 'Unique Id': '', 'Contact No': '9876543210', 'Delivery Date': '2026-07-30' },
    sheet: 'Delivered',
    file: 'delivered_import_template.xlsx',
  },
} as const;

// Canonical field <- accepted header aliases (lower-cased).
const ALIASES: Record<string, string> = {
  'unique id': 'unique_id',
  uniqueid: 'unique_id',
  unique_id: 'unique_id',
  id: 'unique_id',
  'record id': 'unique_id',
  'contact no': 'contact_no',
  'contact number': 'contact_no',
  contact: 'contact_no',
  phone: 'contact_no',
  'delivery partner': 'courier_name',
  courier: 'courier_name',
  'courier name': 'courier_name',
  partner: 'courier_name',
  'awb number': 'awb_number',
  awb: 'awb_number',
  'tracking number': 'awb_number',
  tracking: 'awb_number',
  'dispatch date': 'dispatch_date',
  'dispatched date': 'dispatch_date',
  'delivery date': 'delivered_date',
  'delivered date': 'delivered_date',
  delivered: 'delivered_date',
};

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

/** Excel serial or free-text date -> ISO yyyy-mm-dd (empty on failure). */
function parseDate(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

function mapRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(raw)) {
    const key = ALIASES[k.trim().toLowerCase()];
    if (key) out[key] = val;
  }
  return out;
}

export function BulkImport({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('dispatch');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<(BulkDispatchRow | BulkDeliverRow)[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setFileName('');
    setRows([]);
    setParseError(null);
    setResult(null);
  }

  function switchKind(k: Kind) {
    setKind(k);
    reset();
  }

  function close() {
    setOpen(false);
    reset();
  }

  function downloadTemplate() {
    const t = TEMPLATE[kind];
    const ws = XLSX.utils.json_to_sheet([t.sample], { header: [...t.headers] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t.sheet);
    XLSX.writeFile(wb, t.file);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setResult(null);
    setFileName(file.name);
    try {
      let raw: Record<string, unknown>[] = [];
      if (file.name.toLowerCase().endsWith('.csv')) {
        const parsed = Papa.parse<Record<string, unknown>>(await file.text(), {
          header: true,
          skipEmptyLines: true,
        });
        raw = parsed.data;
      } else {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
          defval: '',
        });
      }

      const mapped = raw.map(mapRow).filter((m) => str(m.unique_id) || str(m.contact_no));
      if (!mapped.length) {
        setParseError('No rows with a Unique Id or Contact No were found. Check the column headers.');
        setRows([]);
        return;
      }

      if (kind === 'dispatch') {
        setRows(
          mapped.map((m) => ({
            unique_id: str(m.unique_id),
            contact_no: str(m.contact_no),
            courier_name: str(m.courier_name),
            awb_number: str(m.awb_number),
            dispatch_date: parseDate(m.dispatch_date),
          })),
        );
      } else {
        setRows(
          mapped.map((m) => ({
            unique_id: str(m.unique_id),
            contact_no: str(m.contact_no),
            delivered_date: parseDate(m.delivered_date),
          })),
        );
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not parse file');
      setRows([]);
    }
  }

  function commit() {
    if (!rows.length) return;
    setResult(null);
    start(async () => {
      const res =
        kind === 'dispatch'
          ? await bulkDispatch({ campaignId, rows: rows as BulkDispatchRow[] })
          : await bulkDeliver({ campaignId, rows: rows as BulkDeliverRow[] });
      setResult(res);
      if (!res.error && res.updated > 0) router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Import
      </Button>

      <Modal open={open} onClose={close} title="Bulk import">
        <div className="space-y-4">
          {/* Kind toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--muted-surface)] p-1">
            {(['dispatch', 'deliver'] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => switchKind(k)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  kind === k
                    ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]',
                )}
              >
                {k === 'dispatch' ? 'Dispatch' : 'Delivered'}
              </button>
            ))}
          </div>

          <p className="text-sm text-[var(--muted)]">
            {kind === 'dispatch'
              ? 'Marks matched, address-confirmed recipients as dispatched.'
              : 'Marks matched, dispatched recipients as delivered.'}{' '}
            Rows are matched by <strong>Unique Id</strong> when present, otherwise by Contact No.
            Expected columns: <strong>{TEMPLATE[kind].headers.join(', ')}</strong>.
            {campaignId ? ' Matching is scoped to the selected campaign.' : ''}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4" /> Download template
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--muted-surface)]">
              <FileSpreadsheet className="h-4 w-4" /> Choose file
              <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
            </label>
            {fileName && <span className="text-xs text-[var(--muted)]">{fileName}</span>}
          </div>

          {parseError && <p className="text-sm text-[var(--danger)]">{parseError}</p>}

          {rows.length > 0 && !result && (
            <p className="text-sm">
              <strong>{rows.length}</strong> row(s) ready to import.
            </p>
          )}

          {result && (
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted-surface)] p-3 text-sm">
              {result.error ? (
                <p className="text-[var(--danger)]">{result.error}</p>
              ) : (
                <p className="font-medium text-[var(--success)]">
                  Updated {result.updated} recipient(s)
                  {result.skipped.length > 0 && `, skipped ${result.skipped.length}`}.
                </p>
              )}
              {result.skipped.length > 0 && (
                <div className="max-h-40 overflow-auto">
                  <ul className="space-y-0.5 text-xs text-[var(--muted)]">
                    {result.skipped.slice(0, 50).map((s, i) => (
                      <li key={i}>
                        <span className="font-mono">{s.contact}</span> — {s.reason}
                      </li>
                    ))}
                  </ul>
                  {result.skipped.length > 50 && (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      …and {result.skipped.length - 50} more.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={close} disabled={pending}>
              {result && !result.error ? 'Close' : 'Cancel'}
            </Button>
            <Button size="sm" onClick={commit} loading={pending} disabled={!rows.length || !!result}>
              {kind === 'dispatch' ? 'Import dispatches' : 'Import deliveries'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
