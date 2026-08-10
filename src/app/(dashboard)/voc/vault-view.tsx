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

/** A report row plus the identifiers the on-screen table needs (audio player). */
type VaultRow = { key: string; vocId: string | null; data: ReportRow };

const dateCell = 'text-xs text-[var(--muted)]';
const muted = (v: string) => <span className="text-xs text-[var(--muted)]">{v}</span>;

/**
 * VOC & Reports reads straight off `call_records` — one row per recipient,
 * kept current by `upsertCallRecord()` from every mutation site (import,
 * calls, dispatch, agent actions). No live joins here: what's stored is
 * what's shown.
 */
export async function VaultView({
  campaignId,
  sp,
}: {
  campaignId?: string;
  sp: { q?: string; status?: string; telecaller?: string; recipientId?: string; page?: string };
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

  let recordsQuery = supabase.from('call_records').select('*');
  if (activeCampaignId) recordsQuery = recordsQuery.eq('campaign_id', activeCampaignId);
  if (sp.status && sp.status in STATUS_LABELS) {
    recordsQuery = recordsQuery.eq('status', sp.status as RecipientStatus);
  }
  if (sp.telecaller) recordsQuery = recordsQuery.eq('telecaller_name', sp.telecaller);

  // Telecaller options are scoped to the active campaign (telecaller names
  // come from the per-campaign import file) but independent of the other
  // filters, same treatment as the campaign/status option lists.
  let telecallerQuery = supabase
    .from('call_records')
    .select('telecaller_name')
    .not('telecaller_name', 'is', null);
  if (activeCampaignId) telecallerQuery = telecallerQuery.eq('campaign_id', activeCampaignId);

  // Recipient ID dropdown options — same campaign-scoped, other-filters-
  // independent treatment. Labelled by name + contact so it's searchable by
  // more than just the raw id.
  let recipientOptionsQuery = supabase
    .from('call_records')
    .select('recipient_id, customer_name, contact_no_e164');
  if (activeCampaignId) recipientOptionsQuery = recipientOptionsQuery.eq('campaign_id', activeCampaignId);

  const [{ data: records }, allLanguages, { data: telecallerRows }, { data: recipientOptionRows }] =
    await Promise.all([
      recordsQuery.order('updated_at', { ascending: false }),
      getLanguages(supabase),
      telecallerQuery,
      recipientOptionsQuery,
    ]);

  const telecallers = Array.from(
    new Set((telecallerRows ?? []).map((r) => r.telecaller_name).filter((v): v is string => !!v)),
  ).sort();

  // Labelled by the unique recipient id itself (never ambiguous, unlike
  // customer name) — name/contact are searchable context in the `sub` line.
  const recipientOptions = (recipientOptionRows ?? [])
    .map((r) => ({
      value: r.recipient_id,
      label: r.recipient_id,
      sub: [r.customer_name, r.contact_no_e164].filter(Boolean).join(' · '),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const langMap: Record<string, string> = {};
  for (const l of allLanguages) langMap[l.code] = l.display_name;

  let rows: VaultRow[] = (records ?? []).map((r) => ({
    key: r.recipient_id,
    vocId: r.voc_recording_id,
    data: {
      campaign: campaignMap.get(r.campaign_id)?.calling_from ?? '—',
      recipient_id: r.recipient_id,
      customer_name: r.customer_name ?? '',
      contact: r.contact_no_e164 ?? '',
      telecaller: r.telecaller_name ?? '—',
      product: r.product_name ?? '',
      status: statusLabel(r.status),
      language: langName(langMap, r.language),
      order_confirmed: formatDate(r.order_confirmed_at),
      dispatched: formatDate(r.dispatched_date),
      delivered: formatDate(r.delivered_date),
      delivery_confirmed: formatDate(r.delivery_confirmed_at),
      sealed_voc_id: r.sealed_voc_id ?? '—',
      dtmf: r.dtmf_outcome ?? '—',
      duration: r.voc_recording_id ? `${r.duration_seconds ?? 0}s` : '—',
    },
  }));

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

  // Dedicated Recipient ID lookup — separate from the general search box,
  // picked from the searchable dropdown below (so this is always an exact id).
  if (sp.recipientId) {
    rows = rows.filter((r) => r.data.recipient_id === sp.recipientId);
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
    {
      header: 'Recipient ID',
      className: 'font-mono text-xs text-[var(--muted)]',
      cell: (r) => r.data.recipient_id,
    },
    { header: 'Telecaller', cell: (r) => r.data.telecaller },
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
        key={[activeCampaignId ?? '', sp.status ?? '', sp.telecaller ?? '', sp.recipientId ?? ''].join('|')}
        basePath={BASE}
        searchPlaceholder="Search by name, contact, product or sealed VOC id"
        searchableSelects={[
          {
            name: 'recipientId',
            label: 'Recipient ID',
            placeholder: 'Any recipient…',
            searchPlaceholder: 'Search by name, contact or ID…',
            allLabel: 'Any recipient',
            width: 'w-64',
            options: recipientOptions,
          },
        ]}
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
            name: 'status',
            label: 'Status',
            width: 'w-56',
            options: [
              { value: '', label: 'All statuses' },
              ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            name: 'telecaller',
            label: 'Telecaller',
            width: 'w-48',
            options: [
              { value: '', label: 'All telecallers' },
              ...telecallers.map((t) => ({ value: t, label: t })),
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
        minWidth="min-w-[1300px]"
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
            status: sp.status,
            telecaller: sp.telecaller,
            recipientId: sp.recipientId,
            page: p,
          })
        }
      />
    </div>
  );
}
