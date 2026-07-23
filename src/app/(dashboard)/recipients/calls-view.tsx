import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getLanguageMap, langName } from '@/lib/domain/languages';
import { CallRunner } from './call-runner';
import { Card, CardHeader, CardTitle, CardContent, Badge, Select } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { ORDER_CALLABLE, DELIVERY_CALLABLE } from '@/lib/domain/status';
import { CALL_TYPE_LABELS, OUTCOME_LABELS } from '@/lib/domain/labels';
import { formatDateTime } from '@/lib/utils';
import type { CallOutcome, CallType, CallerType } from '@/lib/database.types';

const PAGE_SIZE = 15;
const BASE = '/recipients';

export async function CallsView({
  campaignId,
  isAdmin,
  sp,
}: {
  campaignId: string;
  isAdmin: boolean;
  sp: { type?: string; outcome?: string; caller?: string; page?: string };
}) {
  const supabase = await createClient();

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let recentQuery = supabase
    .from('call_attempts')
    .select('*', { count: 'exact' })
    .eq('campaign_id', campaignId);
  if (sp.type) recentQuery = recentQuery.eq('call_type', sp.type as CallType);
  if (sp.outcome) recentQuery = recentQuery.eq('outcome', sp.outcome as CallOutcome);
  if (sp.caller) recentQuery = recentQuery.eq('caller_type', sp.caller as CallerType);

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
    recentQuery.order('created_at', { ascending: false }).range(from, to),
    getLanguageMap(supabase),
  ]);

  const total = recentRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qsFor = (p: number) => {
    const u = new URLSearchParams();
    u.set('campaign', campaignId);
    u.set('view', 'calls');
    if (sp.type) u.set('type', sp.type);
    if (sp.outcome) u.set('outcome', sp.outcome);
    if (sp.caller) u.set('caller', sp.caller);
    u.set('page', String(p));
    return `${BASE}?${u.toString()}`;
  };
  const resetHref = `${BASE}?campaign=${campaignId}&view=calls`;

  return (
    <div className="space-y-6">
      {isAdmin ? (
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

      <FilterBar action={BASE} resetHref={resetHref}>
        <input type="hidden" name="campaign" value={campaignId} />
        <input type="hidden" name="view" value="calls" />
        <FilterField label="Call type">
          <Select name="type" defaultValue={sp.type ?? ''} className="w-52">
            <option value="">All types</option>
            {Object.entries(CALL_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Outcome">
          <Select name="outcome" defaultValue={sp.outcome ?? ''} className="w-56">
            <option value="">All outcomes</option>
            {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Caller">
          <Select name="caller" defaultValue={sp.caller ?? ''} className="w-36">
            <option value="">All callers</option>
            <option value="ivr">IVR</option>
            <option value="agent">Agent</option>
          </Select>
        </FilterField>
      </FilterBar>

      <Card>
        <CardHeader>
          <CardTitle>Call attempts{total ? ` (${total})` : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[55vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] text-left text-[var(--muted)]">
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

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">
                Page {page} of {totalPages}
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
        </CardContent>
      </Card>
    </div>
  );
}
