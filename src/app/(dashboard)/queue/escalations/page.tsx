import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { FormSearchableSelect } from '@/components/ui/form-searchable-select';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/page-header';
import { formatDateTime, buildQuery } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 15;
const BASE = '/queue/escalations';

interface QueueItem {
  id: string;
  customer_name: string | null;
  contact: string | null;
  type: 'Order — address change' | 'Delivery — issue raised';
  updated_at: string;
}

export default async function EscalationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const typeFilter = sp.type ?? '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  await requireUser();
  const supabase = await createClient();

  // Every press-2, from either script, now moves the recipient to
  // `issue_raised` — so this one status query is the whole queue. It replaces
  // the old pair of queries (delivery issues by status, order escalations by
  // hunting for a `transferred_to_agent` call outcome), which existed only
  // because an order-phase press-2 used to leave the status untouched.
  const { data: escalated } = await supabase
    .from('recipients')
    .select('id, customer_name, contact_no_e164, updated_at')
    .eq('status', 'issue_raised')
    .order('updated_at', { ascending: true });

  // Which half of the pipeline each one came from — the status no longer says,
  // so the most recent call's type does. Same rule as the recipient page and
  // `escalationPhase` in app/actions/agent.ts. One query for all of them
  // rather than one per row.
  const escalatedIds = (escalated ?? []).map((r) => r.id);
  const phase = new Map<string, string>();
  if (escalatedIds.length) {
    const { data: recentCalls } = await supabase
      .from('call_attempts')
      .select('recipient_id, call_type, created_at')
      .in('recipient_id', escalatedIds)
      .order('created_at', { ascending: false });
    // Newest-first, so the first row seen per recipient is its latest call.
    for (const c of recentCalls ?? []) {
      if (!phase.has(c.recipient_id)) phase.set(c.recipient_id, c.call_type);
    }
  }

  let items: QueueItem[] = (escalated ?? []).map((r) => ({
    id: r.id,
    customer_name: r.customer_name,
    contact: r.contact_no_e164,
    type:
      phase.get(r.id) === 'delivery_confirmation'
        ? ('Delivery — issue raised' as const)
        : ('Order — address change' as const),
    updated_at: r.updated_at,
  }));

  if (typeFilter === 'order') items = items.filter((i) => i.type.startsWith('Order'));
  else if (typeFilter === 'delivery') items = items.filter((i) => i.type.startsWith('Delivery'));
  items.sort((a, b) => a.updated_at.localeCompare(b.updated_at));

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Escalations"
        description="Press-2 escalations awaiting an agent: order address changes (captured manually) and delivery issues."
      />

      <FilterBar action="/queue/escalations" resetHref="/queue/escalations">
        <FilterField label="Type">
          <FormSearchableSelect
            name="type"
            defaultValue={typeFilter}
            allLabel="All escalations"
            className="w-56"
            options={[
              { value: 'order', label: 'Order — address change' },
              { value: 'delivery', label: 'Delivery — issue raised' },
            ]}
          />
        </FilterField>
        <span className="self-center text-sm text-[var(--muted)]">{total} open</span>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={pageItems}
        rowKey={(it) => `${it.type}-${it.id}`}
        className="max-h-[calc(100vh-15rem)]"
        empty="No open escalations. 🎉"
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) => buildQuery(BASE, { type: sp.type, page: p })}
      />
    </div>
  );
}

const columns: Column<QueueItem>[] = [
  {
    header: 'Recipient',
    cell: (it) => (
      <>
        <p className="font-medium">{it.customer_name ?? '—'}</p>
        <p className="font-mono text-xs text-[var(--muted)]">{it.contact}</p>
      </>
    ),
  },
  {
    header: 'Type',
    cell: (it) => <Badge color={it.type.startsWith('Order') ? 'amber' : 'red'}>{it.type}</Badge>,
  },
  {
    header: 'Waiting since',
    className: 'text-xs text-[var(--muted)]',
    cell: (it) => formatDateTime(it.updated_at),
  },
  {
    header: '',
    cell: (it) => (
      <Link
        href={`/recipients/${it.id}`}
        className="font-medium text-[var(--primary)] hover:underline"
      >
        Handle →
      </Link>
    ),
  },
];
