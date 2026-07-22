import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  // Recipient counts per campaign.
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Campaigns</h1>
          <p className="text-sm text-[var(--muted)]">
            Brand / order batches and their fulfilment pipeline.
          </p>
        </div>
        {user.role === 'admin' && (
          <Link href="/campaigns/new">
            <Button>New campaign</Button>
          </Link>
        )}
      </div>

      {campaigns && campaigns.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`}>
              <Card className="p-5 transition-colors hover:border-[var(--primary)]">
                <p className="font-semibold">{c.calling_from}</p>
                <p className="text-sm text-[var(--muted)]">
                  {c.order_reference ?? 'No order reference'}
                </p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">
                    {totals[c.id] ?? 0} recipients
                  </span>
                  <span className="font-medium text-[var(--success)]">
                    {confirmed[c.id] ?? 0} VOC
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {formatDate(c.start_date)} – {formatDate(c.end_date)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-sm text-[var(--muted)]">
            No campaigns yet.
            {user.role === 'admin' && ' Create one to get started.'}
          </p>
        </Card>
      )}
    </div>
  );
}
