import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getLanguageMap, langName } from '@/lib/domain/languages';
import { getCampaign } from '@/lib/domain/campaigns';
import { statusLabel, STATUS_LABELS } from '@/lib/domain/labels';
import { formatDate } from '@/lib/utils';
import { ReportExport } from '@/components/report-export';
import { Card, CardContent, CardHeader, CardTitle, Select } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import type { CampaignReport, ReportRow } from '@/lib/exports/types';
import type { RecipientStatus } from '@/lib/database.types';

const PAGE_SIZE = 15;
const BASE = '/voc';

export async function ReportsView({
  campaignId,
  sp,
}: {
  campaignId: string;
  sp: { status?: string; page?: string };
}) {
  const supabase = await createClient();

  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return (
      <Card className="p-12 text-center">
        <p className="text-sm text-[var(--muted)]">Campaign not found.</p>
      </Card>
    );
  }

  let recipientsQuery = supabase
    .from('recipients')
    .select('id, customer_name, contact_no_e164, product_name, status, preferred_language')
    .eq('campaign_id', campaignId);
  if (sp.status && sp.status in STATUS_LABELS) {
    recipientsQuery = recipientsQuery.eq('status', sp.status as RecipientStatus);
  }
  const { data: recipients } = await recipientsQuery.order('customer_name');

  const recipientIds = (recipients ?? []).map((r) => r.id);

  const [{ data: dispatches }, { data: vocs }, { data: orderCalls }, langMap] =
    await Promise.all([
      supabase
        .from('dispatches')
        .select('recipient_id, dispatch_date, delivered_date')
        .in('recipient_id', recipientIds.length ? recipientIds : ['00000000-0000-0000-0000-000000000000']),
      supabase
        .from('voc_recordings')
        .select('recipient_id, sealed_voc_id, created_at')
        .eq('campaign_id', campaignId),
      supabase
        .from('call_attempts')
        .select('recipient_id, ended_at')
        .eq('campaign_id', campaignId)
        .eq('call_type', 'order_confirmation')
        .eq('outcome', 'confirmed'),
      getLanguageMap(supabase),
    ]);

  const dispatchMap = new Map((dispatches ?? []).map((d) => [d.recipient_id, d]));
  const vocMap = new Map((vocs ?? []).map((v) => [v.recipient_id, v]));
  const orderMap = new Map<string, string>();
  for (const c of orderCalls ?? []) {
    if (c.ended_at && !orderMap.has(c.recipient_id)) orderMap.set(c.recipient_id, c.ended_at);
  }

  const rows: ReportRow[] = (recipients ?? []).map((r) => {
    const d = dispatchMap.get(r.id);
    const v = vocMap.get(r.id);
    return {
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
    };
  });

  // The export always contains every row matching the current filter; the
  // preview table below is paginated 15 per page.
  const report: CampaignReport = {
    campaignName: campaign.calling_from,
    orderReference: campaign.order_reference ?? '',
    generatedAt: formatDate(new Date().toISOString()),
    rows,
  };

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, parseInt(sp.page ?? '1', 10) || 1), totalPages);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const qsFor = (p: number) => {
    const u = new URLSearchParams();
    u.set('campaign', campaignId);
    u.set('view', 'reports');
    if (sp.status) u.set('status', sp.status);
    u.set('page', String(p));
    return `${BASE}?${u.toString()}`;
  };
  const resetHref = `${BASE}?campaign=${campaignId}&view=reports`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Client report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Recipient-wise status, confirmation dates, language and the sealed VOC id — the
            artefact sent to mjunction. {total} recipient(s)
            {sp.status ? ' (filtered)' : ''}.
          </p>
          <FilterBar
            action={BASE}
            resetHref={resetHref}
            className="!p-0 !border-0 !bg-transparent !shadow-none"
          >
            <input type="hidden" name="campaign" value={campaignId} />
            <input type="hidden" name="view" value="reports" />
            <FilterField label="Status filter">
              <Select name="status" defaultValue={sp.status ?? ''} className="w-56">
                <option value="">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FilterField>
          </FilterBar>
          <ReportExport report={report} />
        </CardContent>
      </Card>

      <div className="max-h-[55vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--muted-surface)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Language</th>
              <th className="px-3 py-2 font-medium">Delivered</th>
              <th className="px-3 py-2 font-medium">Confirmed</th>
              <th className="px-3 py-2 font-medium">Sealed VOC ID</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--border)] last:border-0">
                <td className="px-3 py-1.5">{r.customer_name}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{r.contact}</td>
                <td className="px-3 py-1.5">{r.product}</td>
                <td className="px-3 py-1.5">{r.status}</td>
                <td className="px-3 py-1.5">{r.language}</td>
                <td className="px-3 py-1.5">{r.delivered}</td>
                <td className="px-3 py-1.5">{r.delivery_confirmed}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{r.sealed_voc_id}</td>
              </tr>
            ))}
            {!pageRows.length && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--muted)]">
                  No recipients match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">
            Page {page} of {totalPages} · export contains all {total}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={qsFor(page - 1)} className="rounded-lg border px-3 py-1.5 hover:bg-[var(--muted-surface)]">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={qsFor(page + 1)} className="rounded-lg border px-3 py-1.5 hover:bg-[var(--muted-surface)]">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
