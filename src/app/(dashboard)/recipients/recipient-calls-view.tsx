import { createClient } from '@/lib/supabase/server';
import { getLanguages, langName } from '@/lib/domain/languages';
import { RecipientsTable, type RecipientRow } from './recipients-table';
import { CallRunner } from './call-runner';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { TableFilters } from '@/components/ui/table-filters';
import { STATUS_LABELS } from '@/lib/domain/labels';
import { ORDER_CALLABLE, DELIVERY_CALLABLE } from '@/lib/domain/status';
import { buildQuery } from '@/lib/utils';
import type { RecipientStatus } from '@/lib/database.types';

const PAGE_SIZE = 15;
const BASE = '/recipients';
const NO_MATCH = '00000000-0000-0000-0000-000000000000';

/**
 * Merged Recipients + Calls view. The recipient list is the spine; each row is
 * enriched with an aggregate of that recipient's call attempts (count + most
 * recent attempt's timestamp). Duplicate columns are dropped — the
 * recipient's preferred language is shown, not the per-call language. With no
 * campaign selected, every campaign's recipients are shown with a Campaign
 * column; picking a campaign (via the filter) narrows and enables call batches.
 */
export async function RecipientCallsView({
  campaignId,
  isAdmin,
  sp,
}: {
  campaignId?: string;
  isAdmin: boolean;
  sp: { status?: string; q?: string; telecaller?: string; page?: string };
}) {
  const supabase = await createClient();

  const { data: campaignRows } = await supabase
    .from('campaigns')
    .select('id, calling_from')
    .order('created_at', { ascending: false });
  const campaigns = campaignRows ?? [];

  if (!campaigns.length) {
    return <EmptyState>No campaigns yet. Create a campaign to get started.</EmptyState>;
  }

  const campaignMap = new Map(campaigns.map((c) => [c.id, c.calling_from]));
  const activeCampaignId = campaignId && campaignMap.has(campaignId) ? campaignId : undefined;
  const allCampaigns = !activeCampaignId;

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from('recipients').select('*', { count: 'exact' });
  if (activeCampaignId) query = query.eq('campaign_id', activeCampaignId);
  if (sp.status && sp.status in STATUS_LABELS) {
    query = query.eq('status', sp.status as RecipientStatus);
  }
  if (sp.telecaller) query = query.eq('telecaller_name', sp.telecaller);
  if (sp.q) {
    query = query.or(
      `customer_name.ilike.%${sp.q}%,contact_no.ilike.%${sp.q}%,contact_no_e164.ilike.%${sp.q}%,product_name.ilike.%${sp.q}%`,
    );
  }

  // Telecaller options are scoped to the active campaign (names come from the
  // per-campaign import file) but independent of the other filters, same
  // treatment as the campaign/status option lists.
  let telecallerQuery = supabase
    .from('recipients')
    .select('telecaller_name')
    .not('telecaller_name', 'is', null);
  if (activeCampaignId) telecallerQuery = telecallerQuery.eq('campaign_id', activeCampaignId);

  // Call-batch eligibility counts only matter when a specific campaign is
  // active (a batch runs against one campaign). Run in parallel with the list.
  const countsPromise =
    isAdmin && activeCampaignId
      ? Promise.all([
          supabase
            .from('recipients')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', activeCampaignId)
            .in('status', ORDER_CALLABLE),
          supabase
            .from('recipients')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', activeCampaignId)
            .in('status', DELIVERY_CALLABLE),
        ])
      : Promise.resolve(null);

  const [{ data: recipients, count }, allLanguages, counts, { data: telecallerRows }] = await Promise.all([
    query.order('updated_at', { ascending: false }).range(from, to),
    getLanguages(supabase),
    countsPromise,
    telecallerQuery,
  ]);

  const telecallers = Array.from(
    new Set((telecallerRows ?? []).map((r) => r.telecaller_name).filter((v): v is string => !!v)),
  ).sort();

  const langMap: Record<string, string> = {};
  for (const l of allLanguages) langMap[l.code] = l.display_name;

  const recipientIds = (recipients ?? []).map((r) => r.id);

  // Only the visible page's recipients need call data. Ordered newest-first so
  // the first attempt seen per recipient is the latest.
  const { data: calls } = await supabase
    .from('call_attempts')
    .select('recipient_id, created_at')
    .in('recipient_id', recipientIds.length ? recipientIds : [NO_MATCH])
    .order('created_at', { ascending: false });

  type CallAgg = { attempts: number; last: NonNullable<typeof calls>[number] };
  const callAgg = new Map<string, CallAgg>();
  for (const c of calls ?? []) {
    const cur = callAgg.get(c.recipient_id);
    if (cur) cur.attempts += 1;
    else callAgg.set(c.recipient_id, { attempts: 1, last: c });
  }

  const rows: RecipientRow[] = (recipients ?? []).map((r) => {
    const agg = callAgg.get(r.id);
    return {
      ...r,
      language_name: langName(langMap, r.preferred_language),
      campaign_name: campaignMap.get(r.campaign_id) ?? '—',
      attempts: agg?.attempts ?? 0,
      last_call_at: agg?.last.created_at ?? null,
    };
  });

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {isAdmin && activeCampaignId && counts && (
        <CallRunner
          campaignId={activeCampaignId}
          orderEligible={counts[0].count ?? 0}
          deliveryEligible={counts[1].count ?? 0}
        />
      )}

      <TableFilters
        key={[activeCampaignId ?? '', sp.status ?? '', sp.telecaller ?? ''].join('|')}
        basePath={BASE}
        searchPlaceholder="Name, phone or product"
        searchableSelects={[
          {
            name: 'campaign',
            label: 'Campaign',
            placeholder: 'All campaigns…',
            searchPlaceholder: 'Search campaigns…',
            allLabel: 'All campaigns',
            width: 'w-56',
            options: campaigns.map((c) => ({ value: c.id, label: c.calling_from })),
          },
          {
            name: 'status',
            label: 'Status',
            placeholder: 'All statuses…',
            searchPlaceholder: 'Search statuses…',
            allLabel: 'All statuses',
            width: 'w-48',
            options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
          },
          {
            name: 'telecaller',
            label: 'Telecaller',
            placeholder: 'Any telecaller…',
            searchPlaceholder: 'Search telecallers…',
            allLabel: 'All telecallers',
            width: 'w-48',
            options: telecallers.map((t) => ({ value: t, label: t })),
          },
        ]}
      />

      <RecipientsTable rows={rows} showCampaign={allCampaigns} isAdmin={isAdmin} />

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) =>
          buildQuery(BASE, {
            campaign: activeCampaignId,
            status: sp.status,
            q: sp.q,
            telecaller: sp.telecaller,
            page: p,
          })
        }
      />
    </div>
  );
}
