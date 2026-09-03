'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { logEvent, transitionStatus } from '@/lib/domain/audit';
import { canTransition } from '@/lib/domain/status';
import { escalationPhase } from './agent';
import type { RecipientStatus } from '@/lib/database.types';

export type ChangeAddressState = { error?: string; ok?: boolean };

const MAX_ADDRESS_LEN = 1000;

/**
 * Statuses from which a customer's own address correction should advance the
 * recipient, and the mirror of the check `resolveOrderEscalation` makes for an
 * agent doing the same thing by hand. Anything else — already dispatched,
 * delivered, closed — leaves the status alone: the address is still worth
 * saving, but the pipeline has moved past the point where correcting it means
 * "this order is ready to go".
 */
const ORDER_ESCALATION_STATES: RecipientStatus[] = [
  'issue_raised',
  'order_confirm_pending',
  'order_unreachable',
];

/**
 * Customer-facing, UNAUTHENTICATED address correction (see the public route at
 * app/order/change-address/[recipientId]). Reached via a link we send to the
 * customer, so there is no session — it runs on the service-role client and is
 * therefore deliberately narrow: it looks up a recipient by its unguessable
 * UUID, updates the address, and advances the status exactly as an agent
 * clicking "Save corrected address" would. It touches nothing else — not the
 * phone, not the product — and it cannot enumerate rows (the UUID is the only
 * key).
 *
 * The status transition is not optional decoration. The IVR's press-2 closing
 * now tells the caller they will get a link to fix their address themselves,
 * and this is that link's endpoint: without the transition the recipient saves
 * a corrected address and then sits in the escalations queue anyway, waiting
 * for an agent to re-key what the customer already typed. That was invisible
 * while nothing linked here; it is the whole flow now.
 */
export async function submitAddressChange(
  recipientId: string,
  newAddress: string,
): Promise<ChangeAddressState> {
  const address = newAddress.trim();
  if (!address) return { error: 'Please enter your delivery address.' };
  if (address.length > MAX_ADDRESS_LEN) {
    return { error: 'That address is too long. Please shorten it.' };
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('recipients')
    .select('id, address, status')
    .eq('id', recipientId)
    .single();
  if (!existing) return { error: 'This link is no longer valid.' };

  const { error } = await supabase
    .from('recipients')
    .update({
      address,
      missing_address: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recipientId);
  if (error) return { error: 'Could not save your address. Please try again.' };

  await logEvent(supabase, {
    recipientId,
    eventType: 'edit',
    actorType: 'system',
    payload: {
      action: 'address_updated_by_customer',
      from: existing.address ?? null,
      to: address,
    },
  });

  // `issue_raised` is reachable from both halves of the pipeline, and only the
  // order half means "the address is wrong" — a delivery-phase issue must not
  // be resolved by someone editing an address. The most recent call's type is
  // what separates them, same rule the agent-facing actions use.
  const from = existing.status as RecipientStatus;
  const isOrderPhase =
    ORDER_ESCALATION_STATES.includes(from) &&
    (from !== 'issue_raised' ||
      (await escalationPhase(supabase, recipientId)) === 'order_confirmation');

  // canTransition is checked here rather than left to transitionStatus, which
  // throws: this runs behind an unauthenticated form, and a customer who has
  // successfully saved their address should never see a 500 because the status
  // machine moved on under them.
  if (isOrderPhase && canTransition(from, 'address_corrected')) {
    await transitionStatus(supabase, {
      recipientId,
      from,
      to: 'address_corrected',
      actorType: 'system',
      payload: { via: 'customer_address_change' },
    });
  }

  revalidatePath(`/recipients/${recipientId}`);
  revalidatePath('/recipients');
  revalidatePath('/queue/escalations');
  return { ok: true };
}
