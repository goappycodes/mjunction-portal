import { createClient } from '@/lib/supabase/server';
import { getLanguages, langName } from '@/lib/domain/languages';
import { OUTCOME_LABELS, callStatusLabel, callStatusColor } from '@/lib/domain/labels';
import { formatDate, formatDateTime, buildQuery } from '@/lib/utils';
import { ReportExport } from '@/components/report-export';
import { VocPlayer } from '@/components/voc-player';
import { Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { TableFilters } from '@/components/ui/table-filters';
import type { CampaignReport, ReportRow } from '@/lib/exports/types';
import type { CallOutcome, CallType } from '@/lib/database.types';
import type { VocTab } from './voc-tabs';

const PAGE_SIZE = 15;
const BASE = '/voc';

const TAB_CALL_TYPE: Record<VocTab, CallType> = {
  address: 'order_confirmation',
  delivery: 'delivery_confirmation',
};

/** A report row plus the identifiers the on-screen table needs (audio player, badge color). */
type VaultRow = {
  key: string;
  vocId: string | null;
  outcome: CallOutcome | null;
  providerStatus: string | null;
  recordingUrl: string | null;
  data: ReportRow;
};

const dateCell = 'text-xs text-[var(--muted)]';
const muted = (v: string) => <span className="text-xs text-[var(--muted)]">{v}</span>;

/**
 * VOC & Reports is a call log — one row per call_attempt, not per recipient
 * (an order can be called multiple times). Reads call_attempts directly,
 * joined with the recipient/product/telecaller context and any sealed VOC
 * recording for that specific attempt. Split into two tabs by call_type
 * (`address` = order_confirmation, `delivery` = delivery_confirmation).
 */
export async function VaultView({
  tab,
  campaignId,
  sp,
}: {
  tab: VocTab;
  campaignId?: string;
  sp: { q?: string; status?: string; telecaller?: string; recipientId?: string; page?: string };
}) {
  const supabase = await createClient();
  const callType = TAB_CALL_TYPE[tab];

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

  const CALL_LOG_COLUMNS = `
    id, recipient_id, call_type, attempt_number, outcome, provider_status, language,
    dtmf_response, started_at, ended_at, recording_url, created_at,
    recipients!inner(customer_name, contact_no_e164, product_name, telecaller_name, unique_id, campaign_id),
    voc_recordings(id, sealed_voc_id, duration_seconds)
  ` as const;

  let callsQuery = supabase.from('call_attempts').select(CALL_LOG_COLUMNS).eq('call_type', callType);
  if (activeCampaignId) callsQuery = callsQuery.eq('recipients.campaign_id', activeCampaignId);
  if (sp.status && sp.status in OUTCOME_LABELS) {
    callsQuery = callsQuery.eq('outcome', sp.status as CallOutcome);
  }
  if (sp.telecaller) callsQuery = callsQuery.eq('recipients.telecaller_name', sp.telecaller);

  // Telecaller options are scoped to the active campaign + tab (telecaller
  // names come from the per-campaign import file) but independent of the
  // other filters, same treatment as the campaign/status option lists.
  let telecallerQuery = supabase
    .from('call_attempts')
    .select('recipients!inner(telecaller_name, campaign_id)')
    .eq('call_type', callType)
    .not('recipients.telecaller_name', 'is', null);
  if (activeCampaignId) telecallerQuery = telecallerQuery.eq('recipients.campaign_id', activeCampaignId);

  // Unique Order ID dropdown options — same campaign-scoped, other-filters-
  // independent treatment. Labelled by name + contact so it's searchable by
  // more than just the raw id.
  let recipientOptionsQuery = supabase
    .from('call_attempts')
    .select('recipients!inner(unique_id, customer_name, contact_no_e164, campaign_id)')
    .eq('call_type', callType);
  if (activeCampaignId) recipientOptionsQuery = recipientOptionsQuery.eq('recipients.campaign_id', activeCampaignId);

  const [{ data: calls }, allLanguages, { data: telecallerRows }, { data: recipientOptionRows }] =
    await Promise.all([
      callsQuery.order('created_at', { ascending: false }),
      getLanguages(supabase),
      telecallerQuery,
      recipientOptionsQuery,
    ]);

  const telecallers = Array.from(
    new Set(
      (telecallerRows ?? [])
        .map((r) => (r.recipients as unknown as { telecaller_name: string | null }).telecaller_name)
        .filter((v): v is string => !!v),
    ),
  ).sort();

  // Labelled by the importer-provided Unique Order ID (never ambiguous,
  // unlike customer name) — name/contact are searchable context in the
  // `sub` line. Deduped since the same recipient can appear on many rows.
  const seenUniqueIds = new Set<string>();
  const recipientOptions = (recipientOptionRows ?? [])
    .map(
      (r) =>
        r.recipients as unknown as {
          unique_id: string;
          customer_name: string | null;
          contact_no_e164: string | null;
        },
    )
    .filter((r) => {
      if (seenUniqueIds.has(r.unique_id)) return false;
      seenUniqueIds.add(r.unique_id);
      return true;
    })
    .map((r) => ({
      value: r.unique_id,
      label: r.unique_id,
      sub: [r.customer_name, r.contact_no_e164].filter(Boolean).join(' · '),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const langMap: Record<string, string> = {};
  for (const l of allLanguages) langMap[l.code] = l.display_name;

  let rows: VaultRow[] = (calls ?? []).map((c) => {
    const recipient = c.recipients as unknown as {
      customer_name: string | null;
      contact_no_e164: string | null;
      product_name: string | null;
      telecaller_name: string | null;
      unique_id: string;
      campaign_id: string;
    };
    const voc = (c.voc_recordings as unknown as
      | { id: string; sealed_voc_id: string; duration_seconds: number | null }[]
      | null)?.[0];

    return {
      key: c.id,
      vocId: voc?.id ?? null,
      outcome: c.outcome,
      providerStatus: c.provider_status,
      recordingUrl: c.recording_url,
      data: {
        campaign: campaignMap.get(recipient.campaign_id)?.calling_from ?? '—',
        unique_id: recipient.unique_id,
        customer_name: recipient.customer_name ?? '',
        contact: recipient.contact_no_e164 ?? '',
        telecaller: recipient.telecaller_name ?? '—',
        product: recipient.product_name ?? '',
        attempt_number: c.attempt_number,
        status: callStatusLabel(c.outcome, c.provider_status),
        language: langName(langMap, c.language),
        dtmf: c.dtmf_response ?? '—',
        started_at: formatDateTime(c.started_at),
        ended_at: formatDateTime(c.ended_at),
        sealed_voc_id: voc?.sealed_voc_id ?? '—',
        duration: voc ? `${voc.duration_seconds ?? 0}s` : '—',
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

  // Dedicated Unique Order ID lookup — separate from the general search box,
  // picked from the searchable dropdown below (so this is always an exact id).
  if (sp.recipientId) {
    rows = rows.filter((r) => r.data.unique_id === sp.recipientId);
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
      header: 'Unique Order ID',
      className: 'font-mono text-xs text-[var(--muted)]',
      cell: (r) => r.data.unique_id,
    },
    { header: 'Telecaller', cell: (r) => r.data.telecaller },
    { header: 'Product', cell: (r) => r.data.product || '—' },
    { header: 'Attempt', className: 'text-center tabular-nums', cell: (r) => r.data.attempt_number },
    {
      header: 'Status',
      cell: (r) => <Badge color={callStatusColor(r.outcome, r.providerStatus)}>{r.data.status}</Badge>,
    },
    { header: 'Language', cell: (r) => r.data.language },
    { header: 'DTMF', className: 'font-mono text-xs', cell: (r) => r.data.dtmf },
    { header: 'Started', className: dateCell, cell: (r) => r.data.started_at },
    { header: 'Ended', className: dateCell, cell: (r) => r.data.ended_at },
    {
      header: 'Sealed VOC id',
      className: 'font-mono text-xs',
      cell: (r) => (r.vocId ? <Badge color="green">{r.data.sealed_voc_id}</Badge> : '—'),
    },
    { header: 'Duration', className: 'tabular-nums', cell: (r) => r.data.duration },
    {
      header: 'Recording',
      cell: (r) =>
        r.vocId ? (
          <VocPlayer vocId={r.vocId} />
        ) : r.recordingUrl ? (
          <a
            href={r.recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[var(--primary)] hover:underline"
          >
            Recording
          </a>
        ) : (
          muted('—')
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <TableFilters
        key={[tab, activeCampaignId ?? '', sp.status ?? '', sp.telecaller ?? '', sp.recipientId ?? ''].join('|')}
        basePath={BASE}
        view={tab}
        searchPlaceholder="Search by name, contact, product or sealed VOC id"
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
            width: 'w-56',
            options: Object.entries(OUTCOME_LABELS).map(([value, label]) => ({ value, label })),
          },
          {
            name: 'telecaller',
            label: 'Telecaller',
            placeholder: 'Any telecaller…',
            searchPlaceholder: 'Search telecallers…',
            allLabel: 'All telecallers',
            width: 'w-52',
            options: telecallers.map((t) => ({ value: t, label: t })),
          },
          {
            name: 'recipientId',
            label: 'Unique Order ID',
            placeholder: 'Any recipient…',
            searchPlaceholder: 'Search by name, contact or ID…',
            allLabel: 'Any recipient',
            width: 'w-64',
            options: recipientOptions,
          },
        ]}
      >
        <ReportExport report={report} />
      </TableFilters>

      <DataTable
        columns={columns}
        rows={pageRows}
        rowKey={(r) => r.key}
        minWidth="min-w-[1400px]"
        className="max-h-[calc(100vh-15rem)]"
        empty="No calls match these filters."
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        note={`export contains all ${total}`}
        hrefFor={(p) =>
          buildQuery(BASE, {
            view: tab,
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
