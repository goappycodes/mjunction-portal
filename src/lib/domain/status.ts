import type { RecipientStatus } from '@/lib/database.types';

/**
 * Recipient status machine (TECH_SPEC §6 "Status machine" + PRD pipeline).
 * Encodes allowed transitions. Every transition writes a recipient_events row
 * and updates recipients.status (enforced in Server Actions).
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
