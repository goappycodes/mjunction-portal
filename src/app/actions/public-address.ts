'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/domain/audit';

export type ChangeAddressState = { error?: string; ok?: boolean };

const MAX_ADDRESS_LEN = 1000;

/**
 * Customer-facing, UNAUTHENTICATED address correction (see the public route at
 * app/order/change-address/[recipientId]). Reached via a link we send to the
 * customer, so there is no session — it runs on the service-role client and is
 * therefore deliberately narrow: it looks up a recipient by its unguessable
 * UUID and updates ONLY the address. It never touches status, phone, product,
 * or anything else, and it cannot enumerate rows (the UUID is the only key).
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
    .select('id, address')
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

  revalidatePath(`/recipients/${recipientId}`);
  revalidatePath('/recipients');
  return { ok: true };
}
