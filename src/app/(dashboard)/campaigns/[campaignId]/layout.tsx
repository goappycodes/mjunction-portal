import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getCampaign } from '@/lib/domain/campaigns';
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
  const [user, campaign] = await Promise.all([requireUser(), getCampaign(campaignId)]);

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
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{campaign.calling_from}</h1>
          {campaign.order_reference && (
            <Badge color="indigo">{campaign.order_reference}</Badge>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            {user.role === 'admin' && (
              <Link
                href={`/import?campaign=${campaignId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-medium hover:bg-[var(--muted-surface)]"
              >
                Import
              </Link>
            )}
            <Link
              href={`/recipients?campaign=${campaignId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-medium hover:bg-[var(--muted-surface)]"
            >
              Recipients
            </Link>
            <Link
              href={`/voc?campaign=${campaignId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-medium hover:bg-[var(--muted-surface)]"
            >
              VOC &amp; Reports
            </Link>
          </div>
        </div>
      </div>
      <CampaignTabs campaignId={campaignId} isAdmin={user.role === 'admin'} />
      <div>{children}</div>
    </div>
  );
}
