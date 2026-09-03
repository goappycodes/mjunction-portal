import { createClient } from '@/lib/supabase/server';
import { getLanguages, langName } from '@/lib/domain/languages';
import { OUTCOME_LABELS, callStatusLabel, callStatusColor } from '@/lib/domain/labels';
import { formatDate, formatDateTime, buildQuery } from '@/lib/utils';
import { ReportExport } from '@/components/report-export';
import { Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { TableFilters } from '@/components/ui/table-filters';
import type { Report, ReportRow } from '@/lib/exports/types';
import type { CallOutcome, CallType } from '@/lib/database.types';
import type { VocTab } from './voc-tabs';

const PAGE_SIZE = 15;
const BASE = '/voc';

const TAB_CALL_TYPE: Record<VocTab, CallType> = {
  address: 'order_confirmation',
  delivery: 'delivery_confirmation',
};

/** A report row plus the identifiers the on-screen table needs (badge color, VOC id). */
type VaultRow = {
  key: string;
  vocId: string | null;
  outcome: CallOutcome | null;
  providerStatus: string | null;
  data: ReportRow;
};

const dateCell = 'text-xs text-[var(--muted)]';

/**
 * VOC & Reports is a call log — one row per call_attempt, not per recipient.
 * Split into two tabs by call_type.
 */
export async function VaultView({
  tab,
  sp,
}: {
  tab: VocTab;
  sp: { q?: string; status?: string; telecaller?: string; recipientId?: string; page?: string };
}) {
  const supabase = await createClient();
  const callType = TAB_CALL_TYPE[tab];

  // Neither `recording_url` nor `duration_seconds` is selected any more: the
  // call log no longer shows a Recording link or a Duration column. Both
  // columns are still written by the IVR and still on the row — this is a
  // reporting change, not a data one — so re-adding either here is all it
  // would take to bring them back.
  const CALL_LOG_COLUMNS = `
    id, recipient_id, call_type, attempt_number, outcome, provider_status, language,
    dtmf_response, started_at, ended_at, created_at,
    recipients!inner(customer_name, contact_no_e164, product_name, telecaller_name, unique_id, order_id, company_name),
    voc_recordings(id, sealed_voc_id)
  ` as const;

  let callsQuery = supabase.from('call_attempts').select(CALL_LOG_COLUMNS).eq('call_type', callType);
  if (sp.status && sp.status in OUTCOME_LABELS) {
    callsQuery = callsQuery.eq('outcome', sp.status as CallOutcome);
  }
  if (sp.telecaller) callsQuery = callsQuery.eq('recipients.telecaller_name', sp.telecaller);

  let telecallerQuery = supabase
    .from('call_attempts')
    .select('recipients!inner(telecaller_name)')
    .eq('call_type', callType)
    .not('recipients.telecaller_name', 'is', null);

  let recipientOptionsQuery = supabase
    .from('call_attempts')
    .select('recipients!inner(unique_id, customer_name, contact_no_e164)')
    .eq('call_type', callType);

  const [{ data: calls }, allLanguages, { data: telecallerRows }, { data: recipientOptionRows }] =
    await Promise.all([
      callsQuery.order('created_at', { ascending: false }),
      getLanguages(supabase),
      telecallerQuery,
      recipientOptionsQuery,
    ]);

  if (!calls || calls.length === 0) {
    const emptyMsg =
      callType === 'order_confirmation'
        ? 'No order confirmation calls yet.'
        : 'No delivery confirmation calls yet.';
    if (!sp.status && !sp.telecaller && !sp.q && !sp.recipientId) {
      return <EmptyState>{emptyMsg}</EmptyState>;
    }
  }

  const telecallers = Array.from(
    new Set(
      (telecallerRows ?? [])
        .map((r) => (r.recipients as unknown as { telecaller_name: string | null }).telecaller_name)
        .filter((v): v is string => !!v),
    ),
  ).sort();

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
      order_id: string | null;
      company_name: string | null;
    };
    const voc = (c.voc_recordings as unknown as
      | { id: string; sealed_voc_id: string }[]
      | null)?.[0];

    return {
      key: c.id,
      vocId: voc?.id ?? null,
      outcome: c.outcome,
      providerStatus: c.provider_status,
      data: {
        company_name: recipient.company_name ?? '—',
        unique_id: recipient.unique_id,
        order_id: recipient.order_id ?? '—',
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
      },
    };
  });

  if (sp.q) {
    const needle = sp.q.toLowerCase();
    rows = rows.filter((r) =>
      [r.data.customer_name, r.data.contact, r.data.product, r.data.sealed_voc_id].some((f) =>
        f.toLowerCase().includes(needle),
      ),
    );
  }

  if (sp.recipientId) {
    rows = rows.filter((r) => r.data.unique_id === sp.recipientId);
  }

  const report: Report = {
    generatedAt: formatDate(new Date().toISOString()),
    rows: rows.map((r) => r.data),
  };

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, parseInt(sp.page ?? '1', 10) || 1), totalPages);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<VaultRow>[] = [
    {
      header: 'Company',
      cell: (r) => r.data.company_name || '—',
    },
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
    // The key the caller actually pressed on the menu — "1" to confirm, "2" to
    // raise an issue. Real IVR calls only started recording this once the
    // closing steps began sending the digit alongside the outcome; before
    // that this column was blank for everything but a mock call.
    { header: 'DTMF Input', className: 'font-mono text-xs', cell: (r) => r.data.dtmf },
    { header: 'Started', className: dateCell, cell: (r) => r.data.started_at },
    { header: 'Ended', className: dateCell, cell: (r) => r.data.ended_at },
    {
      header: 'Sealed VOC id',
      className: 'font-mono text-xs',
      cell: (r) => (r.vocId ? <Badge color="green">{r.data.sealed_voc_id}</Badge> : '—'),
    },
  ];

  return (
    <div className="space-y-4">
      <TableFilters
        key={[tab, sp.status ?? '', sp.telecaller ?? '', sp.recipientId ?? ''].join('|')}
        basePath={BASE}
        view={tab}
        searchPlaceholder="Search by name, contact, product or sealed VOC id"
        searchableSelects={[
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
        minWidth="min-w-[1200px]"
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
