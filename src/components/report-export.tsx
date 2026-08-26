'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import type { Report } from '@/lib/exports/types';

const HEADERS: Record<keyof Report['rows'][number], string> = {
  company_name: 'Company',
  unique_id: 'Order Item ID',
  order_id: 'Order ID',
  customer_name: 'Customer Name',
  contact: 'Contact',
  telecaller: 'Telecaller',
  product: 'Product',
  attempt_number: 'Attempt #',
  status: 'Status',
  language: 'Language',
  dtmf: 'DTMF',
  started_at: 'Started',
  ended_at: 'Ended',
  sealed_voc_id: 'Sealed VOC ID',
  duration: 'Duration',
};

export function ReportExport({ report }: { report: Report }) {
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);

  function exportExcel() {
    setBusy('xlsx');
    try {
      const data = report.rows.map((r) =>
        Object.fromEntries(
          (Object.keys(HEADERS) as (keyof typeof HEADERS)[]).map((k) => [HEADERS[k], r[k]]),
        ),
      );
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      XLSX.writeFile(wb, `client_report.xlsx`);
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy('pdf');
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { ReportDoc } = await import('./report-pdf');
      const blob = await pdf(<ReportDoc report={report} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `client_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="success"
        onClick={exportExcel}
        loading={busy === 'xlsx'}
        disabled={busy !== null}
      >
        {busy === 'xlsx' ? 'Building…' : 'Export Excel'}
      </Button>
      <Button
        variant="danger"
        onClick={exportPdf}
        loading={busy === 'pdf'}
        disabled={busy !== null}
      >
        {busy === 'pdf' ? 'Building…' : 'Export PDF'}
      </Button>
    </div>
  );
}
