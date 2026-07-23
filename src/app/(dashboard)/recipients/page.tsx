import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CampaignSelector, type CampaignOption } from '@/components/campaign-selector';
import { SectionTabs, type SectionTab } from '@/components/section-tabs';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/primitives';
import { RecipientsView } from './recipients-view';
import { CallsView } from './calls-view';
import { DispatchView } from './dispatch-view';

export const dynamic = 'force-dynamic';

const BASE = '/recipients';

type ViewKey = 'recipients' | 'calls' | 'dispatch';

export default async function RecipientsHubPage({
  searchParams,
}: {
  searchParams: Promise<{
    campaign?: string;
    view?: string;
    q?: string;
    status?: string;
    lang?: string;
    page?: string;
    type?: string;
    outcome?: string;
    caller?: string;
  }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === 'admin';
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

  const tabs: SectionTab[] = [
    { view: 'recipients', label: 'Recipients' },
    { view: 'calls', label: 'Calls' },
    ...(isAdmin ? [{ view: 'dispatch', label: 'Dispatch' } as SectionTab] : []),
  ];

  const requestedView = (sp.view as ViewKey) ?? 'recipients';
  const view: ViewKey = tabs.some((t) => t.view === requestedView)
    ? requestedView
    : 'recipients';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recipients"
        description="Recipient pipeline, call batches and dispatch for a campaign."
      />

      <CampaignSelector
        campaigns={options}
        selectedId={selected}
        basePath={BASE}
        preserve={{ view: selected ? view : undefined }}
      />

      {selected ? (
        <div className="space-y-5">
          <SectionTabs basePath={BASE} campaignId={selected} active={view} tabs={tabs} />
          {view === 'recipients' && <RecipientsView campaignId={selected} sp={sp} />}
          {view === 'calls' && <CallsView campaignId={selected} isAdmin={isAdmin} sp={sp} />}
          {view === 'dispatch' &&
            (isAdmin ? (
              <DispatchView campaignId={selected} sp={sp} />
            ) : (
              <Card className="p-12 text-center">
                <p className="text-sm text-[var(--muted)]">
                  Dispatch is available to admins only.
                </p>
              </Card>
            ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-sm text-[var(--muted)]">
            {options.length
              ? 'Select a campaign above to view its recipients, calls and dispatch.'
              : 'No campaigns yet. Create a campaign to get started.'}
          </p>
        </Card>
      )}
    </div>
  );
}
