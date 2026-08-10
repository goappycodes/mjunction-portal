import Link from 'next/link';
import { Eye } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Input, Badge } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { DataTable, type Column } from '@/components/ui/data-table';
import { PageHeader } from '@/components/page-header';
import { formatDate } from '@/lib/utils';
import type { Campaign } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

interface CampaignRow extends Campaign {
  recipientCount: number;
  vocCount: number;
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  let query = supabase.from('campaigns').select('*');
  if (sp.q) {
    query = query.or(`calling_from.ilike.%${sp.q}%,order_reference.ilike.%${sp.q}%`);
  }
  const { data: campaigns } = await query.order('created_at', { ascending: false });

  const { data: recips } = await supabase.from('recipients').select('campaign_id, status');
  const totals: Record<string, number> = {};
  const confirmed: Record<string, number> = {};
  for (const r of recips ?? []) {
    totals[r.campaign_id] = (totals[r.campaign_id] ?? 0) + 1;
    if (r.status === 'confirmed' || r.status === 'closed')
      confirmed[r.campaign_id] = (confirmed[r.campaign_id] ?? 0) + 1;
  }

  const rows: CampaignRow[] = (campaigns ?? []).map((c) => ({
    ...c,
    recipientCount: totals[c.id] ?? 0,
    vocCount: confirmed[c.id] ?? 0,
  }));

  const columns: Column<CampaignRow>[] = [
    {
      header: 'Campaign',
      cell: (c) => (
        <>
          <p className="font-medium">{c.calling_from}</p>
          <p className="text-xs text-[var(--muted)]">{c.order_reference ?? 'No order reference'}</p>
        </>
      ),
    },
    {
      header: 'Recipients',
      className: 'tabular-nums',
      cell: (c) => c.recipientCount,
    },
    {
      header: 'Sealed VOCs',
      cell: (c) => (c.vocCount > 0 ? <Badge color="green">{c.vocCount}</Badge> : <span className="text-[var(--muted)]">—</span>),
    },
    {
      header: 'Duration',
      className: 'text-xs text-[var(--muted)]',
      cell: (c) => `${formatDate(c.start_date)} – ${formatDate(c.end_date)}`,
    },
    {
      header: '',
      className: 'text-right',
      cell: (c) => (
        <Link href={`/campaigns/${c.id}`}>
          <Button variant="secondary" size="sm">
            <Eye className="h-4 w-4" /> View
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Brand / order batches and their fulfilment pipeline."
        actions={
          user.role === 'admin' ? (
            <Link href="/campaigns/new">
              <Button>New campaign</Button>
            </Link>
          ) : undefined
        }
      />

      <FilterBar action="/campaigns" resetHref="/campaigns">
        <FilterField label="Search">
          <Input name="q" defaultValue={sp.q ?? ''} placeholder="Brand or order reference" className="w-64" />
        </FilterField>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        empty={sp.q ? 'No campaigns match your search.' : 'No campaigns yet.'}
      />
    </div>
  );
}
