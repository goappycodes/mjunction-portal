import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, Input, Select, Badge } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { PageHeader } from '@/components/page-header';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  let query = supabase.from('campaigns').select('*');
  if (sp.q) {
    query = query.or(`calling_from.ilike.%${sp.q}%,order_reference.ilike.%${sp.q}%`);
  }
  const sort = sp.sort ?? 'recent';
  query =
    sort === 'name'
      ? query.order('calling_from', { ascending: true })
      : query.order('created_at', { ascending: false });

  const { data: campaigns } = await query;

  const { data: recips } = await supabase.from('recipients').select('campaign_id, status');
  const totals: Record<string, number> = {};
  const confirmed: Record<string, number> = {};
  for (const r of recips ?? []) {
    totals[r.campaign_id] = (totals[r.campaign_id] ?? 0) + 1;
    if (r.status === 'confirmed' || r.status === 'closed')
      confirmed[r.campaign_id] = (confirmed[r.campaign_id] ?? 0) + 1;
  }

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
        <FilterField label="Sort by">
          <Select name="sort" defaultValue={sort} className="w-44">
            <option value="recent">Newest first</option>
            <option value="name">Name (A–Z)</option>
          </Select>
        </FilterField>
      </FilterBar>

      {campaigns && campaigns.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`}>
              <Card className="group h-full p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold group-hover:text-[var(--primary)]">{c.calling_from}</p>
                  {(confirmed[c.id] ?? 0) > 0 && (
                    <Badge color="green">{confirmed[c.id]} VOC</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {c.order_reference ?? 'No order reference'}
                </p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-medium">{totals[c.id] ?? 0} recipients</span>
                  <span className="text-xs text-[var(--muted)]">
                    {formatDate(c.start_date)} – {formatDate(c.end_date)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-sm text-[var(--muted)]">
            {sp.q ? 'No campaigns match your search.' : 'No campaigns yet.'}
            {!sp.q && user.role === 'admin' && ' Create one to get started.'}
          </p>
        </Card>
      )}
    </div>
  );
}
