import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLanguageMap, langName } from '@/lib/domain/languages';
import { CallRunner } from './call-runner';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui/primitives';
import { ORDER_CALLABLE, DELIVERY_CALLABLE } from '@/lib/domain/status';
import { CALL_TYPE_LABELS, OUTCOME_LABELS } from '@/lib/domain/labels';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CallsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const [orderCount, deliveryCount, recentRes, langMap] = await Promise.all([
    supabase
      .from('recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ORDER_CALLABLE),
    supabase
      .from('recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', DELIVERY_CALLABLE),
    supabase
      .from('call_attempts')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(20),
    getLanguageMap(supabase),
  ]);

  return (
    <div className="space-y-6">
      {user.role === 'admin' ? (
        <CallRunner
          campaignId={campaignId}
          orderEligible={orderCount.count ?? 0}
          deliveryEligible={deliveryCount.count ?? 0}
        />
      ) : (
        <Card className="p-5">
          <p className="text-sm text-[var(--muted)]">
            Call batches are launched by admins. You can retry unreachable recipients
            from the Unreachable queue.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent call attempts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Caller</th>
                  <th className="py-2 pr-4 font-medium">Language</th>
                  <th className="py-2 pr-4 font-medium">DTMF</th>
                  <th className="py-2 pr-4 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {(recentRes.data ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-4 text-xs text-[var(--muted)]">
                      {formatDateTime(c.created_at)}
                    </td>
                    <td className="py-2 pr-4">{CALL_TYPE_LABELS[c.call_type]}</td>
                    <td className="py-2 pr-4">
                      <Badge color={c.caller_type === 'agent' ? 'purple' : 'blue'}>
                        {c.caller_type}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">
                      {langName(langMap, c.language)}
                      {c.language_defaulted && (
                        <span className="ml-1 text-xs text-[var(--muted)]">(defaulted)</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{c.dtmf_response ?? '—'}</td>
                    <td className="py-2 pr-4 text-xs">
                      {c.outcome ? OUTCOME_LABELS[c.outcome] : '—'}
                    </td>
                  </tr>
                ))}
                {!(recentRes.data ?? []).length && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--muted)]">
                      No calls yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
