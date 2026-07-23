import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ImportWizard } from './import-wizard';
import { CampaignSelector, type CampaignOption } from '@/components/campaign-selector';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const sp = await searchParams;
  await requireAdmin();
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import"
        description="Import a recipient file (Excel / CSV) into a campaign."
      />

      <CampaignSelector campaigns={options} selectedId={selected} basePath="/import" />

      {selected ? (
        <ImportWizard key={selected} campaignId={selected} />
      ) : (
        <Card className="p-12 text-center">
          <p className="text-sm text-[var(--muted)]">
            {options.length
              ? 'Select a campaign above to import recipients into it.'
              : 'No campaigns yet. Create a campaign first, then import recipients.'}
          </p>
        </Card>
      )}
    </div>
  );
}
