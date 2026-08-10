import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ImportWizard } from './import-wizard';
import { BulkDeliveryWizard } from './bulk-delivery-wizard';
import { ImportModeTabs, type ImportMode } from './import-mode-tabs';
import { CampaignSelector, type CampaignOption } from '@/components/campaign-selector';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; mode?: string }>;
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
  const mode: ImportMode = sp.mode === 'delivery' ? 'delivery' : 'import';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import"
        description="Import a recipient file, or bulk mark recipients as delivered — both Excel / CSV, both campaign-scoped."
      />

      <ImportModeTabs mode={mode} campaignId={selected} />

      <CampaignSelector
        campaigns={options}
        selectedId={selected}
        basePath="/import"
        preserve={{ mode }}
      />

      {selected ? (
        mode === 'delivery' ? (
          <BulkDeliveryWizard key={selected} campaignId={selected} />
        ) : (
          <ImportWizard key={selected} campaignId={selected} />
        )
      ) : (
        <EmptyState>
          {options.length
            ? 'Select a campaign above to get started.'
            : 'No campaigns yet. Create a campaign first, then import recipients.'}
        </EmptyState>
      )}
    </div>
  );
}
