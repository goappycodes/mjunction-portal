import type {
  CallOutcome,
  CallType,
  RecipientStatus,
} from '@/lib/database.types';

type BadgeColor =
  | 'slate'
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'indigo'
  | 'purple';

export const STATUS_LABELS: Record<RecipientStatus, string> = {
  imported: 'Imported',
  order_confirm_pending: 'Order Confirm Pending',
  address_confirmed: 'Address Confirmed',
  address_corrected: 'Address Corrected',
  order_unreachable: 'Order Unreachable',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  delivery_confirm_pending: 'Delivery Confirm Pending',
  confirmed: 'Confirmed (VOC)',
  issue_raised: 'Issue Raised',
  delivery_unreachable: 'Delivery Unreachable',
  closed: 'Closed',
};

export const STATUS_COLORS: Record<RecipientStatus, BadgeColor> = {
  imported: 'slate',
  order_confirm_pending: 'amber',
  address_confirmed: 'blue',
  address_corrected: 'indigo',
  order_unreachable: 'red',
  dispatched: 'blue',
  delivered: 'indigo',
  delivery_confirm_pending: 'amber',
  confirmed: 'green',
  issue_raised: 'red',
  delivery_unreachable: 'red',
  closed: 'slate',
};

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  confirmed: 'Confirmed (press 1)',
  corrected: 'Correction / problem (press 2)',
  no_answer: 'No answer',
  wrong_number: 'Wrong number',
  issue_raised: 'Issue raised (press 2)',
  transferred_to_agent: 'Transferred to agent',
  not_reachable: 'Not reachable',
};

export const CALL_TYPE_LABELS: Record<CallType, string> = {
  order_confirmation: 'Order Confirmation',
  delivery_confirmation: 'Delivery Confirmation',
};

export function statusLabel(s: RecipientStatus): string {
  return STATUS_LABELS[s] ?? s;
}
export function statusColor(s: RecipientStatus): BadgeColor {
  return STATUS_COLORS[s] ?? 'slate';
}
