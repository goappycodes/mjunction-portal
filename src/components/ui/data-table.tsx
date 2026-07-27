import * as React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

export interface Column<T> {
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Extra className for the `<td>`. */
  className?: string;
  /** Extra className for the `<th>`. */
  headerClassName?: string;
}

/**
 * Server-friendly table with the shared chrome used across the list views —
 * bordered scroll container, sticky muted header, zebra-less bordered rows.
 * Renders an `EmptyState` when there are no rows. For sortable/clickable
 * tables (TanStack) keep a dedicated client table.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = 'Nothing to show.',
  className,
  minWidth,
  stickyHeader = true,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty?: React.ReactNode;
  /** Wrapper className, e.g. a `max-h-[…]` cap. */
  className?: string;
  /** Min table width class to force horizontal scroll, e.g. `min-w-[1100px]`. */
  minWidth?: string;
  stickyHeader?: boolean;
}) {
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;

  return (
    <div
      className={cn(
        'overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]',
        className,
      )}
    >
      <table className={cn('w-full text-sm', minWidth)}>
        <thead
          className={cn(
            'border-b border-[var(--border)] bg-[var(--muted-surface)] text-left text-[var(--muted)]',
            stickyHeader && 'sticky top-0 z-10',
          )}
        >
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={cn('px-4 py-2.5 font-medium', c.headerClassName)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-b border-[var(--border)] last:border-0">
              {columns.map((c, j) => (
                <td key={j} className={cn('px-4 py-2.5', c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
