'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import type { CampaignReport } from '@/lib/exports/types';

const HEADERS: Record<keyof CampaignReport['rows'][number], string> = {
  customer_name: 'Customer Name',
  contact: 'Contact',
  product: 'Product',
  status: 'Status',
  language: 'Language',
  order_confirmed: 'Order Confirmed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  delivery_confirmed: 'Delivery Confirmed',
  sealed_voc_id: 'Sealed VOC ID',
};

export function ReportExport({ report }: { report: CampaignReport }) {
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);
  const safeName = report.campaignName.replace(/[^\w]+/g, '_');

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
      XLSX.writeFile(wb, `${safeName}_client_report.xlsx`);
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
      a.download = `${safeName}_client_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={exportExcel} disabled={busy !== null}>
        {busy === 'xlsx' ? 'Building…' : 'Export Excel'}
      </Button>
      <Button variant="secondary" onClick={exportPdf} disabled={busy !== null}>
        {busy === 'pdf' ? 'Building…' : 'Export PDF'}
      </Button>
    </div>
  );
}
