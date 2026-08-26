'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Download } from 'lucide-react';
import {
  BULK_DELIVERY_COLUMNS,
  validateDeliveryRows,
  type RawRow,
} from '@/lib/domain/bulk-delivery';
import {
  previewBulkDelivery,
  bulkMarkDelivered,
  type BulkDeliveryRowResult,
  type DeliveryMatch,
} from '@/app/actions/dispatch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/primitives';

type Step = 'upload' | 'preview' | 'done';

const MATCH_LABEL: Record<DeliveryMatch, string> = {
  matched: 'Will mark delivered',
  not_dispatched: 'Not in dispatched state',
  not_found: 'Not found',
  skipped_status: 'Status ≠ Delivered',
  format_error: 'Row error',
};

const MATCH_COLOR: Record<DeliveryMatch, 'green' | 'amber' | 'red' | 'slate'> = {
  matched: 'green',
  not_dispatched: 'amber',
  not_found: 'amber',
  skipped_status: 'slate',
  format_error: 'red',
};

export function BulkDeliveryWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<BulkDeliveryRowResult[]>([]);
  const [counts, setCounts] = useState<Record<DeliveryMatch, number> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null);
  const [pending, start] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFileName(file.name);

    try {
      let raw: RawRow[] = [];
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
        raw = parsed.data;
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        raw = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });
      }
      if (!raw.length) {
        setParseError('The file has no data rows.');
        return;
      }

      const formatted = validateDeliveryRows(raw);
      start(async () => {
        const preview = await previewBulkDelivery({ rows: formatted.rows });
        setRows(preview.rows);
        setCounts(preview.counts);
        setStep('preview');
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not parse file');
    }
  }

  function commit() {
    const matched = rows
      .filter((r) => r.match === 'matched' && r.recipientId && r.delivered_date)
      .map((r) => ({ recipientId: r.recipientId as string, delivered_date: r.delivered_date as string }));
    if (!matched.length) return;

    start(async () => {
      const res = await bulkMarkDelivered({ rows: matched });
      if (res.error) {
        setParseError(res.error);
        return;
      }
      setResult({ updated: res.updated ?? 0, skipped: res.skipped ?? 0 });
      setStep('done');
      router.refresh();
    });
  }

  function reset() {
    setStep('upload');
    setRows([]);
    setCounts(null);
    setResult(null);
    setFileName('');
    setParseError(null);
  }

  function downloadTemplate() {
    const example = ['963153', 'Delivered', ''];
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([[...BULK_DELIVERY_COLUMNS], example]);
    XLSX.utils.book_append_sheet(wb, sheet, 'Bulk delivery');
    XLSX.writeFile(wb, 'bulk-delivery-template.xlsx');
  }

  if (step === 'done' && result) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <p className="text-lg font-semibold text-[var(--success)]">Bulk update complete</p>
          <p className="text-sm">
            Marked <strong>{result.updated}</strong> order(s) as delivered.
            {result.skipped > 0 && ` ${result.skipped} row(s) could not be applied.`}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={reset}>
              Upload another file
            </Button>
            <Button onClick={() => router.push('/orders')}>
              View recipients
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>Bulk mark as delivered (Excel / CSV)</CardTitle>
          <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Download template
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Expected columns: Order Item ID, Delivery Status, Delivery Date. Rows are matched
            to orders by Order Item ID — only rows whose status reads
            &ldquo;Delivered&rdquo; and whose order is currently dispatched get applied.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            className="block text-sm file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--muted-surface)] file:px-3 file:py-1.5 file:text-sm"
          />
          {pending && step === 'upload' && (
            <p className="text-sm text-[var(--muted)]">Matching rows against orders…</p>
          )}
          {parseError && <p className="text-sm text-[var(--danger)]">{parseError}</p>}
        </CardContent>
      </Card>

      {step === 'preview' && counts && (
        <Card>
          <CardHeader>
            <CardTitle>Preview — {fileName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <span>Total rows: <strong>{rows.length}</strong></span>
              <span className="text-[var(--success)]">Will update: <strong>{counts.matched}</strong></span>
              <span className="text-[var(--warning)]">Not dispatched: <strong>{counts.not_dispatched}</strong></span>
              <span className="text-[var(--warning)]">Not found: <strong>{counts.not_found}</strong></span>
              <span className="text-[var(--muted)]">Status skipped: <strong>{counts.skipped_status}</strong></span>
              <span className="text-[var(--danger)]">Row errors: <strong>{counts.format_error}</strong></span>
            </div>

            <div className="max-h-[420px] overflow-auto rounded-md border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--muted-surface)] text-left text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Order Item ID</th>
                    <th className="px-3 py-2 font-medium">Order</th>
                    <th className="px-3 py-2 font-medium">Status (file)</th>
                    <th className="px-3 py-2 font-medium">Delivery date</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((r) => (
                    <tr
                      key={r.rowIndex}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-3 py-1.5 text-xs text-[var(--muted)]">{r.rowIndex}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">
                        {r.unique_id ?? <span className="text-[var(--danger)]">missing</span>}
                      </td>
                      <td className="px-3 py-1.5">{r.customerName ?? '—'}</td>
                      <td className="px-3 py-1.5">{r.delivery_status_raw ?? '—'}</td>
                      <td className="px-3 py-1.5">{r.delivered_date ?? '—'}</td>
                      <td className="px-3 py-1.5">
                        <Badge color={MATCH_COLOR[r.match]}>{MATCH_LABEL[r.match]}</Badge>
                        {r.errors.length > 0 && (
                          <p className="mt-1 text-xs text-[var(--danger)]">{r.errors.join(', ')}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 500 && (
              <p className="text-xs text-[var(--muted)]">Showing first 500 rows of preview.</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={reset} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={commit} loading={pending} disabled={counts.matched === 0}>
                {pending ? 'Updating…' : `Mark ${counts.matched} order(s) delivered`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
