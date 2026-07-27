import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Input, Select } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
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
    .select('id, customer_name, contact_no_e164, status, updated_at, campaigns(calling_from)', {
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

  const cname = (c: unknown) => {
    const cc = Array.isArray(c) ? c[0] : c;
    return (cc as { calling_from?: string } | null)?.calling_from ?? '—';
  };

  const columns: Column<NonNullable<typeof rows>[number]>[] = [
    {
      header: 'Recipient',
      cell: (r) => (
        <>
          <Link href={`/recipients/${r.id}`} className="font-medium hover:underline">
            {r.customer_name ?? '—'}
          </Link>
          <p className="font-mono text-xs text-[var(--muted)]">{r.contact_no_e164}</p>
        </>
      ),
    },
    { header: 'Campaign', cell: (r) => cname(r.campaigns) },
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
        description="No-answer / not-reachable recipients awaiting a retry."
      />

      <FilterBar action="/queue/unreachable" resetHref="/queue/unreachable">
        <FilterField label="Search">
          <Input name="q" defaultValue={sp.q ?? ''} placeholder="Name or phone" className="w-56" />
        </FilterField>
        <FilterField label="Stage">
          <Select name="stage" defaultValue={sp.stage ?? ''} className="w-48">
            <option value="">Order &amp; delivery</option>
            <option value="order">Order unreachable</option>
            <option value="delivery">Delivery unreachable</option>
          </Select>
        </FilterField>
        <span className="self-center text-sm text-[var(--muted)]">{total} pending</span>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        className="max-h-[calc(100vh-15rem)]"
        empty="No unreachable recipients. 🎉"
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) => buildQuery(BASE, { stage: sp.stage, q: sp.q, page: p })}
      />
    </div>
  );
}
