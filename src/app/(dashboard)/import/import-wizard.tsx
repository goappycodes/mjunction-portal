'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { IMPORT_COLUMNS, validateRows, type ImportPreview, type MappedRow } from '@/lib/domain/import';
import { commitImport } from '@/app/actions/import';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/primitives';

type Step = 'upload' | 'preview' | 'done';

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [pending, start] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFileName(file.name);

    try {
      let rows: Record<string, unknown>[] = [];
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        rows = parsed.data;
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      }
      if (!rows.length) {
        setParseError('The file has no data rows.');
        return;
      }
      setPreview(validateRows(rows));
      setStep('preview');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not parse file');
    }
  }

  function commit() {
    if (!preview) return;
    const importable: MappedRow[] = preview.rows
      .filter((r) => r.errors.length === 0 && !r.is_duplicate)
      .map(
        ({
          rowIndex,
          missing_address,
          missing_product,
          phone_valid,
          is_duplicate,
          is_duplicate_unique_id,
          errors,
          ...rest
        }) => {
          void rowIndex; void missing_address; void missing_product; void phone_valid;
          void is_duplicate; void is_duplicate_unique_id; void errors;
          return rest;
        },
      );

    start(async () => {
      const res = await commitImport({
        fileName,
        rows: importable,
        counts: {
          rowCount: preview.rowCount,
          validCount: preview.validCount,
          errorCount: preview.errorCount,
          duplicateCount: preview.duplicateCount,
        },
      });
      if (res.error) {
        setParseError(res.error);
        return;
      }
      setResult({ inserted: res.inserted ?? 0, skipped: res.skippedDuplicates ?? 0 });
      setStep('done');
      router.refresh();
    });
  }

  function reset() {
    setStep('upload');
    setPreview(null);
    setResult(null);
    setFileName('');
    setParseError(null);
  }

  function downloadTemplate() {
    const example = [
      '167594',
      '8000010789',
      '827270',
      '963153',
      '04/08/2026 12:08:13',
      'SUN KING Solar Torch Pro',
      'Rahul Kumar',
      '1',
      '1',
      '221B Baker Street, Mumbai, MH 400001',
      '9876543210',
      '',
      '',
    ];
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([[...IMPORT_COLUMNS], example]);
    XLSX.utils.book_append_sheet(wb, sheet, 'Recipients');
    XLSX.writeFile(wb, 'recipient-import-template.xlsx');
  }

  if (step === 'done' && result) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <p className="text-lg font-semibold text-[var(--success)]">Import complete</p>
          <p className="text-sm">
            Inserted <strong>{result.inserted}</strong> recipient(s).
            {result.skipped > 0 && ` Skipped ${result.skipped} duplicate(s).`}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={reset}>
              Import another file
            </Button>
            <Button onClick={() => router.push('/recipients')}>
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
          <CardTitle>Import recipients (Excel / CSV)</CardTitle>
          <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Download template
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Expected columns (mjunction Purchase Order export): Vendor Dispatch Id, Vendor PO
            Number, Order ID, Order Item ID, Order Date, Product Name, Recipent Name, Ordered
            Quantity, Dispatch Quantity, Address, Phone No., Email Id, Courier Name. Order Item
            ID is required and must be distinct per recipient/order — it&apos;s the id used for
            bulk-delivery matching and IVR calls (Order ID may repeat across items on the same
            order). Phones are normalised to E.164 (India); duplicates are flagged.
            Not sure about the format? Download the template above and fill it in.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            className="block text-sm file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--muted-surface)] file:px-3 file:py-1.5 file:text-sm"
          />
          {parseError && <p className="text-sm text-[var(--danger)]">{parseError}</p>}
        </CardContent>
      </Card>

      {step === 'preview' && preview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview — {fileName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <span>Total rows: <strong>{preview.rowCount}</strong></span>
              <span className="text-[var(--success)]">Valid: <strong>{preview.validCount}</strong></span>
              <span className="text-[var(--warning)]">Duplicates: <strong>{preview.duplicateCount}</strong></span>
              <span className="text-[var(--danger)]">Errors: <strong>{preview.errorCount}</strong></span>
            </div>

            <div className="max-h-[420px] overflow-auto rounded-md border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--muted-surface)] text-left text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Order Item ID</th>
                    <th className="px-3 py-2 font-medium">Order ID</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Phone (E.164)</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 500).map((r) => {
                    const bad = r.errors.length > 0;
                    return (
                      <tr
                        key={r.rowIndex}
                        className={`border-b border-[var(--border)] last:border-0 ${
                          bad ? 'bg-red-50' : r.is_duplicate ? 'bg-amber-50' : ''
                        }`}
                      >
                        <td className="px-3 py-1.5 text-xs text-[var(--muted)]">{r.rowIndex}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {r.unique_id ?? <span className="text-[var(--danger)]">missing</span>}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">{r.order_id ?? '—'}</td>
                        <td className="px-3 py-1.5">{r.customer_name ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {r.contact_no_e164 ?? <span className="text-[var(--danger)]">invalid</span>}
                        </td>
                        <td className="px-3 py-1.5">{r.product_name ?? '—'}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {r.errors.map((e, i) => (
                              <Badge key={i} color="red">{e}</Badge>
                            ))}
                            {r.is_duplicate && <Badge color="amber">duplicate</Badge>}
                            {r.missing_address && !bad && <Badge color="amber">no address</Badge>}
                            {r.missing_product && !bad && <Badge color="amber">no product</Badge>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 500 && (
              <p className="text-xs text-[var(--muted)]">Showing first 500 rows of preview.</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={reset} disabled={pending}>
                Cancel
              </Button>
              <Button
                onClick={commit}
                loading={pending}
                disabled={preview.validCount === 0}
              >
                {pending ? 'Importing…' : `Commit ${preview.validCount} valid row(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
