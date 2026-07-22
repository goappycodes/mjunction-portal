'use client';

import { useRouter } from 'next/navigation';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { formatDateTime } from '@/lib/utils';
import type { Recipient } from '@/lib/database.types';

export interface RecipientRow extends Recipient {
  language_name: string;
}

const col = createColumnHelper<RecipientRow>();

export function RecipientsTable({ rows }: { rows: RecipientRow[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = [
    col.accessor('customer_name', {
      header: 'Customer',
      cell: (c) => <span className="font-medium">{c.getValue() ?? '—'}</span>,
    }),
    col.accessor('contact_no_e164', {
      header: 'Contact',
      cell: (c) => (
        <span className="font-mono text-xs">{c.getValue() ?? c.row.original.contact_no ?? '—'}</span>
      ),
    }),
    col.accessor('product_name', { header: 'Product', cell: (c) => c.getValue() ?? '—' }),
    col.accessor('status', {
      header: 'Status',
      cell: (c) => <StatusBadge status={c.getValue()} />,
    }),
    col.accessor('language_name', { header: 'Language' }),
    col.accessor('updated_at', {
      header: 'Updated',
      cell: (c) => <span className="text-xs text-[var(--muted)]">{formatDateTime(c.getValue())}</span>,
    }),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-12 text-center text-sm text-[var(--muted)]">
        No recipients match this filter.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--muted-surface)]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className="cursor-pointer select-none px-4 py-2.5 text-left font-medium text-[var(--muted)]"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted() as string] ?? ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => router.push(`/recipients/${row.original.id}`)}
              className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted-surface)]"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-2.5">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
