import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CampaignSelector, type CampaignOption } from '@/components/campaign-selector';
import { SectionTabs, type SectionTab } from '@/components/section-tabs';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/primitives';
import { VocView } from './voc-view';
import { ReportsView } from './reports-view';

export const dynamic = 'force-dynamic';

const BASE = '/voc';

type ViewKey = 'voc' | 'reports';

const TABS: SectionTab[] = [
  { view: 'voc', label: 'VOC vault' },
  { view: 'reports', label: 'Reports' },
];

export default async function VocReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    campaign?: string;
    view?: string;
    q?: string;
    lang?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  await requireUser();
  const supabase = await createClient();

  // Latest campaigns first for the selector.
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, calling_from, order_reference, created_at')
    .order('created_at', { ascending: false });

  const options: CampaignOption[] = (campaigns ?? []).map((c) => ({
    id: c.id,
    label: c.calling_from,
    sub: c.order_reference,
  }));

  const selected =
    sp.campaign && options.some((o) => o.id === sp.campaign) ? sp.campaign : undefined;

  const requestedView = (sp.view as ViewKey) ?? 'voc';
  const view: ViewKey = TABS.some((t) => t.view === requestedView) ? requestedView : 'voc';

  return (
    <div className="space-y-6">
      <PageHeader
        title="VOC & Reports"
        description="Sealed VOC recordings and the client report for a campaign."
      />

      <CampaignSelector
        campaigns={options}
        selectedId={selected}
        basePath={BASE}
        preserve={{ view: selected ? view : undefined }}
      />

      {selected ? (
        <div className="space-y-5">
          <SectionTabs basePath={BASE} campaignId={selected} active={view} tabs={TABS} />
          {view === 'voc' && <VocView campaignId={selected} sp={sp} />}
          {view === 'reports' && <ReportsView campaignId={selected} sp={sp} />}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-sm text-[var(--muted)]">
            {options.length
              ? 'Select a campaign above to view its sealed VOCs and client report.'
              : 'No campaigns yet. Create a campaign to get started.'}
          </p>
        </Card>
      )}
    </div>
  );
}
