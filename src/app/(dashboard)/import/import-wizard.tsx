'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { validateRows, type ImportPreview, type MappedRow } from '@/lib/domain/import';
import { commitImport } from '@/app/actions/import';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/primitives';

type Step = 'upload' | 'preview' | 'done';

export function ImportWizard({ campaignId }: { campaignId: string }) {
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
      .map(({ rowIndex, missing_address, missing_product, phone_valid, is_duplicate, errors, ...rest }) => {
        void rowIndex; void missing_address; void missing_product; void phone_valid; void is_duplicate; void errors;
        return rest;
      });

    start(async () => {
      const res = await commitImport({
        campaignId,
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
            <Button onClick={() => router.push(`/recipients?campaign=${campaignId}`)}>
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
        <CardHeader>
          <CardTitle>Import recipients (Excel / CSV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Expected columns: Calling From, Tele Caller name, Contact No, Customer Name,
            Address, Product Name, and (delivery file only) Product Delivery Date. Phones are
            normalised to E.164 (India); duplicates within the campaign are flagged.
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
