import type { RecipientStatus } from '@/lib/database.types';

/**
 * Coarse pipeline stage per status, used only to decide which milestones are
 * "earlier" than the recipient's current status for rollback purposes. Branch
 * statuses (address_corrected, order_unreachable, issue_raised,
 * delivery_unreachable) share a stage with the milestone they branch from —
 * see STATUS_TRANSITIONS in ./status.ts for the real transition graph, which
 * this intentionally simplifies.
 */
const STAGE: Record<RecipientStatus, number> = {
  imported: 0,
  order_confirm_pending: 1,
  order_unreachable: 1,
  address_confirmed: 2,
  address_corrected: 2,
  dispatched: 3,
  delivered: 4,
  delivery_confirm_pending: 5,
  issue_raised: 5,
  delivery_unreachable: 5,
  confirmed: 6,
  closed: 7,
};

/** Milestone statuses a recipient can be rolled back to. */
export const ROLLBACK_MILESTONES: RecipientStatus[] = [
  'imported',
  'order_confirm_pending',
  'address_confirmed',
  'dispatched',
  'delivered',
  'delivery_confirm_pending',
  'confirmed',
];

/** Milestones strictly earlier than `current` — the valid rollback targets. */
export function getRollbackTargets(current: RecipientStatus): RecipientStatus[] {
  return ROLLBACK_MILESTONES.filter((s) => STAGE[s] < STAGE[current]);
}
