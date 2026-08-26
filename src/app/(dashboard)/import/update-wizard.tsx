'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { updateRecipients } from '@/app/actions/import';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';

const UPDATE_COLUMNS = ['Order Item ID', 'Company Name'] as const;

type Step = 'upload' | 'preview' | 'done';

interface UpdateRow {
  unique_id: string;
  company_name: string;
  rowIndex: number;
  errors: string[];
}

function mapUpdateRows(raw: Record<string, unknown>[]): UpdateRow[] {
  return raw.map((r, i) => {
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      normalized[k.trim().toLowerCase()] = String(v ?? '').trim();
    }
    const unique_id = normalized['order item id'] ?? normalized['unique_id'] ?? normalized['order_item_id'] ?? '';
    const company_name = normalized['company name'] ?? normalized['company_name'] ?? '';

    const errors: string[] = [];
    if (!unique_id) errors.push('Order Item ID is required');
    if (!company_name) errors.push('Company Name is required');

    return { unique_id, company_name, rowIndex: i + 1, errors };
  });
}

export function UpdateWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<UpdateRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ updated: number; notFound: number } | null>(null);
  const [pending, start] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFileName(file.name);

    try {
      let raw: Record<string, unknown>[] = [];
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        raw = parsed.data;
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      }
      if (!raw.length) {
        setParseError('The file has no data rows.');
        return;
      }
      setRows(mapUpdateRows(raw));
      setStep('preview');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not parse file');
    }
  }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  function commit() {
    if (!validRows.length) return;
    start(async () => {
      const res = await updateRecipients({
        rows: validRows.map(({ unique_id, company_name }) => ({ unique_id, company_name })),
      });
      if (res.error) {
        setParseError(res.error);
        return;
      }
      setResult({ updated: res.updated ?? 0, notFound: res.notFound ?? 0 });
      setStep('done');
      router.refresh();
    });
  }

  function reset() {
    setStep('upload');
    setRows([]);
    setResult(null);
    setFileName('');
    setParseError(null);
  }

  function downloadTemplate() {
    const example = ['963153', 'Acme Corp'];
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([[...UPDATE_COLUMNS], example]);
    XLSX.utils.book_append_sheet(wb, sheet, 'Update Recipients');
    XLSX.writeFile(wb, 'update-recipients-template.xlsx');
  }

  if (step === 'done' && result) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <p className="text-lg font-semibold text-[var(--success)]">Update complete</p>
          <p className="text-sm">
            Updated <strong>{result.updated}</strong> recipient(s).
            {result.notFound > 0 && ` ${result.notFound} Order Item ID(s) not found.`}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={reset}>
              Update another file
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
          <CardTitle>Update recipients (Excel / CSV)</CardTitle>
          <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Download template
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Upload a file with two columns: <strong>Order Item ID</strong> and{' '}
            <strong>Company Name</strong>. Each row updates the company name for the matching
            recipient. Order Item IDs that do not exist are counted as not found.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            className="block text-sm file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--muted-surface)] file:px-3 file:py-1.5 file:text-sm"
          />
          {parseError && <p className="text-sm text-[var(--destructive)]">{parseError}</p>}
        </CardContent>
      </Card>

      {step === 'preview' && rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview — {rows.length} row(s)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="font-medium text-[var(--success)]">{validRows.length} valid</span>
              {errorCount > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-[var(--destructive)]">{errorCount} with errors (skipped)</span>
                </>
              )}
            </p>
            <div className="max-h-64 overflow-y-auto rounded border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--muted-surface)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Order Item ID</th>
                    <th className="px-3 py-2 text-left font-medium">Company Name</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowIndex} className="border-t border-[var(--border)]">
                      <td className="px-3 py-1.5 text-[var(--muted)]">{r.rowIndex}</td>
                      <td className="px-3 py-1.5 font-mono">{r.unique_id || '—'}</td>
                      <td className="px-3 py-1.5">{r.company_name || '—'}</td>
                      <td className="px-3 py-1.5">
                        {r.errors.length > 0 ? (
                          <span className="text-[var(--destructive)]">{r.errors.join(', ')}</span>
                        ) : (
                          <span className="text-[var(--success)]">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button onClick={commit} disabled={pending || validRows.length === 0}>
                {pending ? 'Updating…' : `Update ${validRows.length} recipient(s)`}
              </Button>
              <Button variant="secondary" onClick={reset}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
