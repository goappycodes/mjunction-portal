import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Input } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { FormSearchableSelect } from '@/components/ui/form-searchable-select';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { RetryButton } from './retry-button';
import { formatDateTime, buildQuery } from '@/lib/utils';
import type { RecipientStatus } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 15;
const BASE = '/queue/unreachable';

export default async function UnreachablePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  await requireUser();
  const supabase = await createClient();

  const stageStatuses: RecipientStatus[] =
    sp.stage === 'order'
      ? ['order_unreachable']
      : sp.stage === 'delivery'
        ? ['delivery_unreachable']
        : ['order_unreachable', 'delivery_unreachable'];

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('recipients')
    .select('id, customer_name, contact_no_e164, status, updated_at', {
      count: 'exact',
    })
    .in('status', stageStatuses);
  if (sp.q) {
    query = query.or(`customer_name.ilike.%${sp.q}%,contact_no_e164.ilike.%${sp.q}%`);
  }
  const { data: rows, count } = await query
    .order('updated_at', { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<NonNullable<typeof rows>[number]>[] = [
    {
      header: 'Order',
      cell: (r) => (
        <>
          <Link href={`/orders/${r.id}`} className="font-medium hover:underline">
            {r.customer_name ?? '—'}
          </Link>
          <p className="font-mono text-xs text-[var(--muted)]">{r.contact_no_e164}</p>
        </>
      ),
    },
    { header: 'Stage', cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Since',
      className: 'text-xs text-[var(--muted)]',
      cell: (r) => formatDateTime(r.updated_at),
    },
    { header: 'Actions', cell: (r) => <RetryButton recipientId={r.id} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Unreachable"
        description="No-answer / not-reachable orders awaiting a retry."
      />

      <FilterBar action="/queue/unreachable" resetHref="/queue/unreachable">
        <FilterField label="Search">
          <Input name="q" defaultValue={sp.q ?? ''} placeholder="Name or phone" className="w-56" />
        </FilterField>
        <FilterField label="Stage">
          <FormSearchableSelect
            name="stage"
            defaultValue={sp.stage ?? ''}
            allLabel="Order & delivery"
            className="w-48"
            options={[
              { value: 'order', label: 'Order unreachable' },
              { value: 'delivery', label: 'Delivery unreachable' },
            ]}
          />
        </FilterField>
        <span className="self-center text-sm text-[var(--muted)]">{total} pending</span>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        className="max-h-[calc(100vh-15rem)]"
        empty="No unreachable orders. 🎉"
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) => buildQuery(BASE, { stage: sp.stage, q: sp.q, page: p })}
      />
    </div>
  );
}
