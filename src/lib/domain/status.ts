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
 */
export const STATUS_TRANSITIONS: Record<RecipientStatus, RecipientStatus[]> = {
  imported: ['order_confirm_pending'],
  order_confirm_pending: [
    'address_confirmed',
    'address_corrected',
    'order_unreachable',
    'order_confirm_pending', // retry
  ],
  address_confirmed: ['dispatched'],
  address_corrected: ['dispatched', 'address_confirmed'],
  order_unreachable: ['order_confirm_pending', 'address_confirmed', 'address_corrected'],
  dispatched: ['delivered'],
  delivered: ['delivery_confirm_pending'],
  delivery_confirm_pending: [
    'confirmed',
    'issue_raised',
    'delivery_unreachable',
    'delivery_confirm_pending', // retry
  ],
  confirmed: ['closed'],
  issue_raised: ['closed', 'delivery_confirm_pending'],
  delivery_unreachable: ['delivery_confirm_pending', 'confirmed', 'issue_raised'],
  closed: [],
};

export function canTransition(from: RecipientStatus, to: RecipientStatus): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

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
  // corrected | issue_raised | transferred_to_agent -> stays put.
  return from;
}

/**
 * Delivery-confirmation call outcome -> resulting status, the counterpart of
 * `orderConfirmationStatusFor` for the second half of the pipeline. Mirrors
 * `deliveryConfirmationStatusFor` in the IVR engine's `_shared/status.ts`
 * (same name, same shape, kept in sync by hand — see the module comment).
 *
 * `transferred_to_agent` deliberately leaves the recipient where it is: the
 * delivery IVR's "problem with the item" branch live-transfers the caller to
 * their telecaller, and until that human resolves it the recipient is still
 * awaiting delivery confirmation. The escalations queue keys off
 * `call_attempts.outcome`, not the recipient status, so nothing is lost.
 */
export function deliveryConfirmationStatusFor(
  outcome: CallOutcome,
  from: RecipientStatus,
): RecipientStatus {
  if (outcome === 'confirmed') return 'confirmed';
  if (outcome === 'issue_raised') return 'issue_raised';
  if (outcome === 'no_answer' || outcome === 'wrong_number' || outcome === 'not_reachable') {
    return 'delivery_unreachable';
  }
  // corrected | transferred_to_agent -> stays put, pending a human.
  return from;
}
