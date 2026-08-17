import type { CallOutcome, RecipientStatus } from '@/lib/database.types';

/**
 * Recipient status machine (TECH_SPEC §6 "Status machine" + PRD pipeline).
 * Encodes allowed transitions. Every transition writes a recipient_events row
 * and updates recipients.status (enforced in Server Actions).
 *
 * The IVR engine (separate repo, mjunction-ivr-engine) keeps its own copy of
 * this table at supabase/functions/_shared/status.ts, since it's a Deno edge
 * function deployed independently of this Next.js app — there is no shared
 * package between the two runtimes/repos. The two are verified identical as
 * of this change; keep them in sync by hand when either one changes.
 *
 * ISSUE_RAISED — every press-2 lands here.
 * The IVR used to live-transfer a press-2 caller to their telecaller, which
 * left the recipient at `order_confirm_pending` with the escalation recorded
 * only as a `call_attempts.outcome`. That transfer is retired: pressing 2 on
 * any menu, in either half of the pipeline, now moves the recipient to
 * `issue_raised` and the escalations queue reads that status directly. No new
 * enum value was added — `issue_raised` already meant exactly this, it just
 * used to be reachable only from the delivery half.
 */
export const STATUS_TRANSITIONS: Record<RecipientStatus, RecipientStatus[]> = {
  imported: ['order_confirm_pending'],
  order_confirm_pending: [
    'address_confirmed',
    'address_corrected',
    'order_unreachable',
    'issue_raised', // press 2 on either menu — see ISSUE_RAISED note below
    'order_confirm_pending', // retry
  ],
  address_confirmed: ['dispatched'],
  address_corrected: ['dispatched', 'address_confirmed'],
  order_unreachable: [
    'order_confirm_pending',
    'address_confirmed',
    'address_corrected',
    'issue_raised',
  ],
  dispatched: ['delivered'],
  delivered: ['delivery_confirm_pending'],
  delivery_confirm_pending: [
    'confirmed',
    'issue_raised',
    'delivery_unreachable',
    'delivery_confirm_pending', // retry
  ],
  confirmed: ['closed'],
  // `issue_raised` is now raised from BOTH halves of the pipeline (see the
  // note below), so it has to be resolvable back into either. An order-phase
  // escalation ends with the agent capturing the address (-> address_confirmed
  // / address_corrected) or re-queueing the call; a delivery-phase one ends
  // closed or re-queued for another delivery call.
  issue_raised: [
    'closed',
    'delivery_confirm_pending',
    'address_confirmed',
    'address_corrected',
    'order_confirm_pending',
  ],
  delivery_unreachable: ['delivery_confirm_pending', 'confirmed', 'issue_raised'],
  closed: [],
};

export function canTransition(from: RecipientStatus, to: RecipientStatus): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Every status, in pipeline order. Used by the admin status-override dropdown
 * on the recipient page, which deliberately ignores STATUS_TRANSITIONS — the
 * whole point of that control is to rescue a recipient that is already in the
 * wrong state, which by definition means moving somewhere the machine would
 * not allow.
 */
export const ALL_STATUSES: RecipientStatus[] = [
  'imported',
  'order_confirm_pending',
  'address_confirmed',
  'address_corrected',
  'order_unreachable',
  'dispatched',
  'delivered',
  'delivery_confirm_pending',
  'confirmed',
  'issue_raised',
  'delivery_unreachable',
  'closed',
];

/** Statuses eligible for an order-confirmation (mock) call batch. */
export const ORDER_CALLABLE: RecipientStatus[] = [
  'imported',
  'order_confirm_pending',
  'order_unreachable',
];

/** Statuses eligible for a delivery-confirmation (mock) call batch. */
export const DELIVERY_CALLABLE: RecipientStatus[] = [
  'delivery_confirm_pending',
  'delivery_unreachable',
];

/**
 * Order-confirmation call outcome -> resulting status. Mirrors
 * `orderConfirmationStatusFor` in the IVR engine's `_shared/status.ts` (same
 * name, same shape, kept in sync by hand — see the module comment above).
 */
export function orderConfirmationStatusFor(
  outcome: CallOutcome,
  from: RecipientStatus,
): RecipientStatus {
  if (outcome === 'confirmed') return 'address_confirmed';
  if (outcome === 'no_answer' || outcome === 'wrong_number' || outcome === 'not_reachable') {
    return 'order_unreachable';
  }
  if (outcome === 'issue_raised' || outcome === 'transferred_to_agent') return 'issue_raised';
  // `corrected` stays put: it is written by the agent resolving an escalation,
  // which applies its own transition, not by the IVR.
  return from;
}

/**
 * Delivery-confirmation call outcome -> resulting status, the counterpart of
 * `orderConfirmationStatusFor` for the second half of the pipeline. Mirrors
 * `deliveryConfirmationStatusFor` in the IVR engine's `_shared/status.ts`
 * (same name, same shape, kept in sync by hand — see the module comment).
 *
 * `transferred_to_agent` maps here too, only because historical rows carry it
 * — the live transfer itself is retired (see the ISSUE_RAISED note above).
 */
export function deliveryConfirmationStatusFor(
  outcome: CallOutcome,
  from: RecipientStatus,
): RecipientStatus {
  if (outcome === 'confirmed') return 'confirmed';
  if (outcome === 'issue_raised' || outcome === 'transferred_to_agent') return 'issue_raised';
  if (outcome === 'no_answer' || outcome === 'wrong_number' || outcome === 'not_reachable') {
    return 'delivery_unreachable';
  }
  // `corrected` stays put — agent-written, same as on the order side.
  return from;
}
