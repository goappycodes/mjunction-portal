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
  campaign: string | null;
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

  // Delivery issues.
  const { data: issues } = await supabase
    .from('recipients')
    .select('id, customer_name, contact_no_e164, updated_at, campaigns(calling_from)')
    .eq('status', 'issue_raised')
    .order('updated_at', { ascending: true });

  // Order escalations: press-2 transfers still awaiting agent (status pending).
  const { data: transfers } = await supabase
    .from('call_attempts')
    .select('recipient_id')
    .eq('call_type', 'order_confirmation')
    .eq('outcome', 'transferred_to_agent');
  const transferIds = Array.from(new Set((transfers ?? []).map((t) => t.recipient_id)));

  let orderEscalations: typeof issues = [];
  if (transferIds.length) {
    const { data } = await supabase
      .from('recipients')
      .select('id, customer_name, contact_no_e164, updated_at, campaigns(calling_from)')
      .in('id', transferIds)
      .eq('status', 'order_confirm_pending')
      .order('updated_at', { ascending: true });
    orderEscalations = data ?? [];
  }

  const cname = (c: unknown) => {
    const cc = Array.isArray(c) ? c[0] : c;
    return (cc as { calling_from?: string } | null)?.calling_from ?? null;
  };

  let items: QueueItem[] = [
    ...(orderEscalations ?? []).map((r) => ({
      id: r.id,
      customer_name: r.customer_name,
      contact: r.contact_no_e164,
      campaign: cname(r.campaigns),
      type: 'Order — address change' as const,
      updated_at: r.updated_at,
    })),
    ...(issues ?? []).map((r) => ({
      id: r.id,
      customer_name: r.customer_name,
      contact: r.contact_no_e164,
      campaign: cname(r.campaigns),
      type: 'Delivery — issue raised' as const,
      updated_at: r.updated_at,
    })),
  ];

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
        description="Press-2 transfers awaiting an agent: order address changes (captured manually) and delivery issues."
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
  { header: 'Campaign', cell: (it) => it.campaign ?? '—' },
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
