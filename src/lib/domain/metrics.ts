import type { SupabaseClient } from '@supabase/supabase-js';
import type { CallOutcome, Database, RecipientStatus } from '@/lib/database.types';

type DB = SupabaseClient<Database>;

export interface Metrics {
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

/** Compute dashboard metrics across all recipients. */
export async function getMetrics(db: DB): Promise<Metrics> {
  const q = db.from('recipients').select('status, preferred_language');
  const vocQ = db.from('voc_recordings').select('*', { count: 'exact', head: true });

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

// ---------------------------------------------------------------------------
// Daily activity — how much calling actually happened, day by day.
//
// Deliberately sourced from `call_attempts` alone rather than the
// `recipient_events` timeline. One row is created per call placed, carrying
// both the call type and (once known) the outcome, so a single query answers
// "how many calls" and "how did they go" without joining anything. It also
// means the numbers here are activity — work done on a given day — and not a
// snapshot of the pipeline, which is what the status cards above already show.
// ---------------------------------------------------------------------------

/**
 * Days are bucketed in **IST**, not the server's timezone or UTC.
 *
 * This matters: an 8pm IST call is already "tomorrow" in UTC, so UTC buckets
 * would push a chunk of every evening's calling into the next day and make
 * both today's counts and the trend wrong for the people reading them. The
 * app formats every other date as `en-IN` too, so the whole UI stays on one
 * calendar. Hardcoded rather than read from the server locale because the
 * answer must not change with where this happens to be deployed.
 */
const ACTIVITY_TIME_ZONE = 'Asia/Kolkata';

/** `YYYY-MM-DD` for an instant, as it fell on the IST calendar. */
export function istDateKey(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  // en-CA gives ISO-ordered `YYYY-MM-DD`, which sorts lexicographically.
  return d.toLocaleDateString('en-CA', { timeZone: ACTIVITY_TIME_ZONE });
}

export interface DailyActivity {
  /** `YYYY-MM-DD`, IST. */
  date: string;
  orderCalls: number;
  deliveryCalls: number;
  totalCalls: number;
  /** Calls that ended in a clean confirm — an address confirmed, or a delivery confirmed. */
  confirmed: number;
  /** Reported problems and live transfers — the calls that feed the queues. */
  issues: number;
  /** Never connected: no answer, wrong number, not reachable. */
  unreachable: number;
  /** Placed but not yet resolved — a real call still in flight, or one that hung up mid-menu. */
  inProgress: number;
}

export interface ActivitySummary {
  /** Oldest first, one entry per day in the window — including days with no activity. */
  days: DailyActivity[];
  /** The last entry in `days`; today in IST, zeroed if nothing has happened yet. */
  today: DailyActivity;
}

const CONFIRMED_OUTCOMES: CallOutcome[] = ['confirmed'];
const ISSUE_OUTCOMES: CallOutcome[] = ['corrected', 'issue_raised', 'transferred_to_agent'];
const UNREACHABLE_OUTCOMES: CallOutcome[] = ['no_answer', 'wrong_number', 'not_reachable'];

function emptyDay(date: string): DailyActivity {
  return {
    date,
    orderCalls: 0,
    deliveryCalls: 0,
    totalCalls: 0,
    confirmed: 0,
    issues: 0,
    unreachable: 0,
    inProgress: 0,
  };
}

/**
 * Build the list of IST date keys in the window, oldest first, so days with
 * zero activity still appear (a gap in the chart is information — a missing
 * bar just looks like the chart is broken).
 */
function dateWindow(days: number): string[] {
  const keys: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    keys.push(istDateKey(new Date(now - i * 86_400_000)));
  }
  return keys;
}

/**
 * Per-day call activity for the last `days` days (IST). Counts every call
 * placed in the window, bucketed by the day it
 * was created and split by call type and outcome.
 */
export async function getDailyActivity(
  db: DB,
  days = 14,
): Promise<ActivitySummary> {
  const window = dateWindow(days);

  // Fetch from the start of the earliest IST day in the window. The bound is
  // computed in UTC and deliberately generous by a day — IST is UTC+5:30, so
  // a naive `T00:00:00Z` bound would drop the first 5.5 hours of the oldest
  // day. Rows outside the window are discarded by the bucketing below, since
  // only keys present in `window` are counted.
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const q = db
    .from('call_attempts')
    .select('created_at, call_type, outcome')
    .gte('created_at', since);

  const { data } = await q;

  const byDate = new Map(window.map((d) => [d, emptyDay(d)]));

  for (const row of data ?? []) {
    const bucket = byDate.get(istDateKey(row.created_at));
    if (!bucket) continue; // outside the window — see the `since` comment above

    bucket.totalCalls += 1;
    if (row.call_type === 'delivery_confirmation') bucket.deliveryCalls += 1;
    else bucket.orderCalls += 1;

    const outcome = row.outcome as CallOutcome | null;
    if (!outcome) bucket.inProgress += 1;
    else if (CONFIRMED_OUTCOMES.includes(outcome)) bucket.confirmed += 1;
    else if (ISSUE_OUTCOMES.includes(outcome)) bucket.issues += 1;
    else if (UNREACHABLE_OUTCOMES.includes(outcome)) bucket.unreachable += 1;
  }

  const daysOut = window.map((d) => byDate.get(d)!);
  return { days: daysOut, today: daysOut[daysOut.length - 1] };
}
