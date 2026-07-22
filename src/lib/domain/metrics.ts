import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, RecipientStatus } from '@/lib/database.types';

type DB = SupabaseClient<Database>;

export interface CampaignMetrics {
  total: number;
  statusCounts: Record<string, number>;
  languageCounts: Record<string, number>;
  orderConfirmRate: number; // address confirmed/corrected / total
  deliveryRate: number; // delivered+ / dispatched+
  vocRate: number; // confirmed (VOC) / delivery attempted
  escalations: number;
  unreachable: number;
  vocSealed: number;
}

const ORDER_DONE: RecipientStatus[] = ['address_confirmed', 'address_corrected'];
const POST_DISPATCH: RecipientStatus[] = [
  'dispatched',
  'delivered',
  'delivery_confirm_pending',
  'confirmed',
  'issue_raised',
  'delivery_unreachable',
  'closed',
];
const DELIVERED_PLUS: RecipientStatus[] = [
  'delivered',
  'delivery_confirm_pending',
  'confirmed',
  'issue_raised',
  'delivery_unreachable',
  'closed',
];

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

/** Compute dashboard metrics for a campaign (or all campaigns if id omitted). */
export async function getMetrics(db: DB, campaignId?: string): Promise<CampaignMetrics> {
  let q = db.from('recipients').select('status, preferred_language');
  if (campaignId) q = q.eq('campaign_id', campaignId);
  let vocQ = db.from('voc_recordings').select('*', { count: 'exact', head: true });
  if (campaignId) vocQ = vocQ.eq('campaign_id', campaignId);

  // Run both round-trips in parallel.
  const [{ data: recips }, { count: vocSealed }] = await Promise.all([q, vocQ]);
  const rows = recips ?? [];

  const statusCounts: Record<string, number> = {};
  const languageCounts: Record<string, number> = {};
  for (const r of rows) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    const lang = r.preferred_language ?? 'unset';
    languageCounts[lang] = (languageCounts[lang] ?? 0) + 1;
  }

  const total = rows.length;
  const count = (list: RecipientStatus[]) =>
    list.reduce((s, st) => s + (statusCounts[st] ?? 0), 0);

  const orderConfirmed = count(ORDER_DONE) + count(POST_DISPATCH);
  const dispatchedPlus = count(POST_DISPATCH);
  const deliveredPlus = count(DELIVERED_PLUS);
  const vocConfirmed = statusCounts['confirmed'] ?? 0;
  const deliveryAttempted =
    (statusCounts['confirmed'] ?? 0) +
    (statusCounts['issue_raised'] ?? 0) +
    (statusCounts['delivery_unreachable'] ?? 0) +
    (statusCounts['closed'] ?? 0);

  return {
    total,
    statusCounts,
    languageCounts,
    orderConfirmRate: pct(orderConfirmed, total),
    deliveryRate: pct(deliveredPlus, dispatchedPlus),
    vocRate: pct(vocConfirmed, deliveryAttempted),
    escalations:
      (statusCounts['issue_raised'] ?? 0),
    unreachable:
      (statusCounts['order_unreachable'] ?? 0) +
      (statusCounts['delivery_unreachable'] ?? 0),
    vocSealed: vocSealed ?? 0,
  };
}
