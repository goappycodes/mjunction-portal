import { createClient } from '@/lib/supabase/server';
import { getLanguages, langName } from '@/lib/domain/languages';
import { statusLabel, STATUS_LABELS } from '@/lib/domain/labels';
import { formatDate, buildQuery } from '@/lib/utils';
import { ReportExport } from '@/components/report-export';
import { VocPlayer } from '@/components/voc-player';
import { Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { TableFilters } from '@/components/ui/table-filters';
import type { CampaignReport, ReportRow } from '@/lib/exports/types';
import type { RecipientStatus } from '@/lib/database.types';

const PAGE_SIZE = 15;
const BASE = '/voc';
const NO_MATCH = '00000000-0000-0000-0000-000000000000';

/** A report row plus the identifiers the on-screen table needs (audio player). */
type VaultRow = { key: string; vocId: string | null; data: ReportRow };

const dateCell = 'text-xs text-[var(--muted)]';
const muted = (v: string) => <span className="text-xs text-[var(--muted)]">{v}</span>;

export async function VaultView({
  campaignId,
  sp,
}: {
  campaignId?: string;
  sp: { q?: string; lang?: string; status?: string; sort?: string; page?: string };
}) {
  const supabase = await createClient();

  // Campaigns power the filter dropdown, the per-row label and validation of
  // the incoming ?campaign= param — fetched first (tiny table) so everything
  // below can key off a trusted id.
  const { data: campaignRows } = await supabase
    .from('campaigns')
    .select('id, calling_from, order_reference')
    .order('created_at', { ascending: false });
  const campaigns = campaignRows ?? [];

  if (!campaigns.length) {
    return <EmptyState>No campaigns yet. Create a campaign to get started.</EmptyState>;
  }

  const campaignMap = new Map(campaigns.map((c) => [c.id, c]));
  const activeCampaignId = campaignId && campaignMap.has(campaignId) ? campaignId : undefined;
  const allCampaigns = !activeCampaignId;

  // The recipient list is the spine of the combined view: every recipient
  // appears and the sealed VOC (if any) enriches the row. With no campaign
  // selected we show every campaign's recipients.
  let recipientsQuery = supabase
    .from('recipients')
    .select('id, campaign_id, customer_name, contact_no_e164, product_name, status, preferred_language');
  if (activeCampaignId) recipientsQuery = recipientsQuery.eq('campaign_id', activeCampaignId);
  if (sp.lang) recipientsQuery = recipientsQuery.eq('preferred_language', sp.lang);
  if (sp.status && sp.status in STATUS_LABELS) {
    recipientsQuery = recipientsQuery.eq('status', sp.status as RecipientStatus);
  }

  const sort = sp.sort ?? 'recent';
  const { data: recipients } = await (sort === 'name'
    ? recipientsQuery.order('customer_name', { ascending: true })
    : recipientsQuery.order('updated_at', { ascending: false }));
  const recipientIds = (recipients ?? []).map((r) => r.id);
  const idFilter = recipientIds.length ? recipientIds : [NO_MATCH];

  let dispatchesQuery = supabase
    .from('dispatches')
    .select('recipient_id, dispatch_date, delivered_date');
  if (activeCampaignId) dispatchesQuery = dispatchesQuery.in('recipient_id', idFilter);

  let vocsQuery = supabase
    .from('voc_recordings')
    .select('id, recipient_id, sealed_voc_id, created_at, dtmf_outcome, duration_seconds');
  if (activeCampaignId) vocsQuery = vocsQuery.eq('campaign_id', activeCampaignId);

  let orderCallsQuery = supabase
    .from('call_attempts')
    .select('recipient_id, ended_at')
    .eq('call_type', 'order_confirmation')
    .eq('outcome', 'confirmed');
  if (activeCampaignId) orderCallsQuery = orderCallsQuery.eq('campaign_id', activeCampaignId);

  const [{ data: dispatches }, { data: vocs }, { data: orderCalls }, allLanguages] =
    await Promise.all([dispatchesQuery, vocsQuery, orderCallsQuery, getLanguages(supabase)]);

  const langMap: Record<string, string> = {};
  for (const l of allLanguages) langMap[l.code] = l.display_name;

  const dispatchMap = new Map((dispatches ?? []).map((d) => [d.recipient_id, d]));
  const vocMap = new Map((vocs ?? []).map((v) => [v.recipient_id, v]));
  const orderMap = new Map<string, string>();
  for (const c of orderCalls ?? []) {
    if (c.ended_at && !orderMap.has(c.recipient_id)) orderMap.set(c.recipient_id, c.ended_at);
  }

  let rows: VaultRow[] = (recipients ?? []).map((r) => {
    const d = dispatchMap.get(r.id);
    const v = vocMap.get(r.id);
    return {
      key: r.id,
      vocId: v?.id ?? null,
      data: {
        campaign: campaignMap.get(r.campaign_id)?.calling_from ?? '—',
        customer_name: r.customer_name ?? '',
        contact: r.contact_no_e164 ?? '',
        product: r.product_name ?? '',
        status: statusLabel(r.status),
        language: langName(langMap, r.preferred_language),
        order_confirmed: formatDate(orderMap.get(r.id) ?? null),
        dispatched: formatDate(d?.dispatch_date ?? null),
        delivered: formatDate(d?.delivered_date ?? null),
        delivery_confirmed: v ? formatDate(v.created_at) : '—',
        sealed_voc_id: v?.sealed_voc_id ?? '—',
        dtmf: v?.dtmf_outcome ?? '—',
        duration: v ? `${v.duration_seconds ?? 0}s` : '—',
      },
    };
  });

  // Free-text search spans name, contact, product and sealed VOC id so the
  // vault's old "search by sealed VOC id" behaviour survives the merge.
  if (sp.q) {
    const needle = sp.q.toLowerCase();
    rows = rows.filter((r) =>
      [r.data.customer_name, r.data.contact, r.data.product, r.data.sealed_voc_id].some((f) =>
        f.toLowerCase().includes(needle),
      ),
    );
  }

  const selectedCampaign = activeCampaignId ? campaignMap.get(activeCampaignId) : undefined;

  // The export always contains every row matching the current filters; the
  // table below is paginated 15 per page.
  const report: CampaignReport = {
    campaignName: selectedCampaign?.calling_from ?? 'All campaigns',
    orderReference: selectedCampaign?.order_reference ?? '',
    generatedAt: formatDate(new Date().toISOString()),
    rows: rows.map((r) => r.data),
  };

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, parseInt(sp.page ?? '1', 10) || 1), totalPages);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<VaultRow>[] = [
    ...(allCampaigns
      ? [{ header: 'Campaign', cell: (r: VaultRow) => r.data.campaign }]
      : []),
    {
      header: 'Recipient',
      cell: (r) => (
        <>
          <p className="font-medium">{r.data.customer_name || '—'}</p>
          <p className="font-mono text-xs text-[var(--muted)]">{r.data.contact}</p>
        </>
      ),
    },
    { header: 'Product', cell: (r) => r.data.product || '—' },
    { header: 'Status', cell: (r) => r.data.status },
    { header: 'Language', cell: (r) => r.data.language },
    { header: 'Order confirmed', className: dateCell, cell: (r) => r.data.order_confirmed },
    { header: 'Dispatched', className: dateCell, cell: (r) => r.data.dispatched },
    { header: 'Delivered', className: dateCell, cell: (r) => r.data.delivered },
    { header: 'Delivery confirmed', className: dateCell, cell: (r) => r.data.delivery_confirmed },
    {
      header: 'Sealed VOC id',
      className: 'font-mono text-xs',
      cell: (r) => (r.vocId ? <Badge color="green">{r.data.sealed_voc_id}</Badge> : '—'),
    },
    { header: 'DTMF', className: 'font-mono text-xs', cell: (r) => r.data.dtmf },
    { header: 'Duration', className: 'tabular-nums', cell: (r) => r.data.duration },
    {
      header: 'Recording',
      cell: (r) => (r.vocId ? <VocPlayer vocId={r.vocId} /> : muted('—')),
    },
  ];

  return (
    <div className="space-y-4">
      <TableFilters
        key={[activeCampaignId ?? '', sp.lang ?? '', sp.status ?? ''].join('|')}
        basePath={BASE}
        searchPlaceholder="Search by name, contact, product or sealed VOC id"
        selects={[
          {
            name: 'campaign',
            label: 'Campaign',
            width: 'w-56',
            options: [
              { value: '', label: 'All campaigns' },
              ...campaigns.map((c) => ({ value: c.id, label: c.calling_from })),
            ],
          },
          {
            name: 'lang',
            label: 'Language',
            width: 'w-40',
            options: [
              { value: '', label: 'All languages' },
              ...allLanguages
                .filter((l) => l.is_active)
                .map((l) => ({ value: l.code, label: l.display_name })),
            ],
          },
          {
            name: 'status',
            label: 'Status',
            width: 'w-56',
            options: [
              { value: '', label: 'All statuses' },
              ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            name: 'sort',
            label: 'Sort by',
            width: 'w-44',
            options: [
              { value: 'recent', label: 'Newest first' },
              { value: 'name', label: 'Name (A–Z)' },
            ],
          },
        ]}
      >
        <ReportExport report={report} />
      </TableFilters>

      <DataTable
        columns={columns}
        rows={pageRows}
        rowKey={(r) => r.key}
        minWidth="min-w-[1100px]"
        className="max-h-[calc(100vh-15rem)]"
        empty="No recipients match these filters."
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        note={`export contains all ${total}`}
        hrefFor={(p) =>
          buildQuery(BASE, {
            campaign: activeCampaignId,
            q: sp.q,
            lang: sp.lang,
            status: sp.status,
            sort: sp.sort,
            page: p,
          })
        }
      />
    </div>
  );
}
