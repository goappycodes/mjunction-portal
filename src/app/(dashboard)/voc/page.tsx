import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { VaultView } from './vault-view';
import { VocTabs, type VocTab } from './voc-tabs';

export const dynamic = 'force-dynamic';

export default async function VocReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    campaign?: string;
    q?: string;
    status?: string;
    telecaller?: string;
    recipientId?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  await requireUser();
  const tab: VocTab = sp.view === 'delivery' ? 'delivery' : 'address';

  return (
    <div className="space-y-6">
      <PageHeader
        title="VOC & Reports"
        description="Call log and the client report, in one place. All campaigns by default — filter to narrow down."
      />
      <VocTabs
        tab={tab}
        otherParams={{
          campaign: sp.campaign,
          q: sp.q,
          status: sp.status,
          telecaller: sp.telecaller,
          recipientId: sp.recipientId,
        }}
      />
      <VaultView tab={tab} campaignId={sp.campaign} sp={sp} />
    </div>
  );
}
