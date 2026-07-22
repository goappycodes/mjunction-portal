import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLanguageMap, langName } from '@/lib/domain/languages';
import { Card, CardContent, Badge } from '@/components/ui/primitives';
import { VocPlayer } from '@/components/voc-player';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function VocPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  await requireUser();
  const supabase = await createClient();

  const [{ data: vocs }, langMap] = await Promise.all([
    supabase
      .from('voc_recordings')
      .select('*, recipients(customer_name, contact_no_e164)')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false }),
    getLanguageMap(supabase),
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Sealed VOC recordings in the private vault — retained indefinitely, played via
        short-lived signed URLs. {vocs?.length ?? 0} recording(s).
      </p>

      {vocs && vocs.length ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--muted-surface)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Sealed VOC id</th>
                <th className="px-4 py-2.5 font-medium">Recipient</th>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Language</th>
                <th className="px-4 py-2.5 font-medium">DTMF</th>
                <th className="px-4 py-2.5 font-medium">Duration</th>
                <th className="px-4 py-2.5 font-medium">Sealed</th>
                <th className="px-4 py-2.5 font-medium">Recording</th>
              </tr>
            </thead>
            <tbody>
              {vocs.map((v) => {
                const rec = Array.isArray(v.recipients) ? v.recipients[0] : v.recipients;
                return (
                  <tr key={v.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Badge color="green">{v.sealed_voc_id}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{rec?.customer_name ?? '—'}</p>
                      <p className="font-mono text-xs text-[var(--muted)]">
                        {rec?.contact_no_e164 ?? ''}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">{v.product_name ?? '—'}</td>
                    <td className="px-4 py-2.5">{langName(langMap, v.language)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{v.dtmf_outcome ?? '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums">{v.duration_seconds ?? 0}s</td>
                    <td className="px-4 py-2.5 text-xs text-[var(--muted)]">
                      {formatDateTime(v.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <VocPlayer vocId={v.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-sm text-[var(--muted)]">
            No sealed VOCs yet. Confirmed delivery-confirmation calls seal a VOC here.
          </p>
        </Card>
      )}
    </div>
  );
}
