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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/primitives';
import { CALL_TYPE_LABELS, OUTCOME_LABELS } from '@/lib/domain/labels';
import { formatDateTime } from '@/lib/utils';
import { RecipientRowActions } from './recipient-row-actions';
import type { CallOutcome, CallType, CallerType, Recipient, RecipientStatus } from '@/lib/database.types';

/**
 * A recipient enriched with its language name and an aggregate of its call
 * attempts (count + the fields of the most recent attempt). One row per
 * recipient — the full per-recipient call history lives on the detail page.
 */
export interface RecipientRow extends Recipient {
  language_name: string;
  campaign_name: string;
  attempts: number;
  last_call_at: string | null;
  last_call_type: CallType | null;
  last_caller: CallerType | null;
  last_dtmf: string | null;
  last_outcome: CallOutcome | null;
}

const col = createColumnHelper<RecipientRow>();

const muted = (v: string | null) => (
  <span className="text-xs text-[var(--muted)]">{v ?? '—'}</span>
);

export function RecipientsTable({
  rows,
  showCampaign = false,
  isAdmin = false,
}: {
  rows: RecipientRow[];
  showCampaign?: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  // Local per-row status patches so a dispatch / delivery updates just that row
  // without re-rendering the whole page. Cleared when a fresh page/filter of
  // rows arrives from the server.
  const [patches, setPatches] = useState<Record<string, RecipientStatus>>({});
  useEffect(() => setPatches({}), [rows]);

  const onStatusChange = useCallback(
    (id: string, status: RecipientStatus) => setPatches((p) => ({ ...p, [id]: status })),
    [],
  );

  const data = useMemo(
    () => rows.map((r) => (patches[r.id] ? { ...r, status: patches[r.id] } : r)),
    [rows, patches],
  );

  // Rebuilt only when a structural input changes — avoids reallocating column
  // defs (and reconciling table state) on every sort/render.
  const columns = useMemo(
    () => [
      ...(showCampaign
        ? [
            col.accessor('campaign_name', {
              header: 'Campaign',
              cell: (c) => <span className="font-medium">{c.getValue()}</span>,
            }),
          ]
        : []),
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
      col.accessor('attempts', {
        header: 'Attempts',
        cell: (c) => <span className="tabular-nums">{c.getValue()}</span>,
      }),
      col.accessor('last_call_at', {
        header: 'Last call',
        cell: (c) => muted(c.getValue() ? formatDateTime(c.getValue() as string) : null),
      }),
      col.accessor('last_call_type', {
        header: 'Call type',
        cell: (c) => {
          const v = c.getValue();
          return v ? CALL_TYPE_LABELS[v] : '—';
        },
      }),
      col.accessor('last_caller', {
        header: 'Caller',
        cell: (c) => {
          const v = c.getValue();
          return v ? <Badge color={v === 'agent' ? 'purple' : 'blue'}>{v}</Badge> : '—';
        },
      }),
      col.accessor('last_dtmf', {
        header: 'DTMF',
        cell: (c) => <span className="font-mono text-xs">{c.getValue() ?? '—'}</span>,
      }),
      col.accessor('last_outcome', {
        header: 'Outcome',
        cell: (c) => {
          const v = c.getValue();
          return <span className="text-xs">{v ? OUTCOME_LABELS[v] : '—'}</span>;
        },
      }),
      col.accessor('updated_at', {
        header: 'Updated',
        cell: (c) => muted(formatDateTime(c.getValue())),
      }),
      ...(isAdmin
        ? [
            col.display({
              id: 'actions',
              header: 'Actions',
              cell: (c) => (
                <RecipientRowActions
                  recipientId={c.row.original.id}
                  status={c.row.original.status}
                  onStatusChange={onStatusChange}
                />
              ),
            }),
          ]
        : []),
    ],
    [showCampaign, isAdmin, onStatusChange],
  );

  const table = useReactTable({
    data,
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
    <div className="max-h-[65vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full min-w-[1200px] text-sm">
        <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--muted-surface)]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                  className={`px-4 py-2.5 text-left font-medium text-[var(--muted)] ${
                    h.column.getCanSort() ? 'cursor-pointer select-none' : ''
                  }`}
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
