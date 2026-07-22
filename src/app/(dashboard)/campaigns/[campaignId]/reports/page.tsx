import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLanguageMap, langName } from '@/lib/domain/languages';
import { statusLabel } from '@/lib/domain/labels';
import { formatDate } from '@/lib/utils';
import { ReportExport } from '@/components/report-export';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import type { CampaignReport, ReportRow } from '@/lib/exports/types';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  if (!campaign) notFound();

  const { data: recipients } = await supabase
    .from('recipients')
    .select('id, customer_name, contact_no_e164, product_name, status, preferred_language')
    .eq('campaign_id', campaignId)
    .order('customer_name');

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

  const report: CampaignReport = {
    campaignName: campaign.calling_from,
    orderReference: campaign.order_reference ?? '',
    generatedAt: formatDate(new Date().toISOString()),
    rows,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Client report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Recipient-wise status, confirmation dates, language and the sealed VOC id — the
            artefact sent to mjunction. {rows.length} recipient(s).
          </p>
          <ReportExport report={report} />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--muted-surface)] text-left text-[var(--muted)]">
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
            {rows.slice(0, 100).map((r, i) => (
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
          </tbody>
        </table>
      </div>
      {rows.length > 100 && (
        <p className="text-xs text-[var(--muted)]">
          Showing first 100 rows in preview; export contains all {rows.length}.
        </p>
      )}
    </div>
  );
}
