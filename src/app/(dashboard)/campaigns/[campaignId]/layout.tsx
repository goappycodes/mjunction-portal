import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CampaignTabs } from './campaign-tabs';
import { Badge } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function CampaignLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/campaigns"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Campaigns
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{campaign.calling_from}</h1>
          {campaign.order_reference && (
            <Badge color="indigo">{campaign.order_reference}</Badge>
          )}
        </div>
      </div>
      <CampaignTabs campaignId={campaignId} isAdmin={user.role === 'admin'} />
      <div>{children}</div>
    </div>
  );
}
