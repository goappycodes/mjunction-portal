'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/domain/audit';
import { normalizePhone } from '@/lib/domain/phone';

export type UpdateRecipientState = { error?: string; ok?: boolean };

export interface UpdateRecipientInput {
  recipientId: string;
  customerName: string;
  contactNo: string;
  address: string;
  productName: string;
  productDeliveryDate: string | null;
  telecallerName: string;
  telecallerPhone: string;
}

/**
 * Admin-only edit of a recipient's own details (not its pipeline status —
 * that only ever moves through the status machine / agent actions). Used by
 * the "Edit" popup on the recipient detail page for correcting import
 * mistakes (typo'd phone, wrong telecaller, etc.) without a re-import.
 */
export async function updateRecipient(
  input: UpdateRecipientInput,
): Promise<UpdateRecipientState> {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('recipients')
    .select('id')
    .eq('id', input.recipientId)
    .single();
  if (!existing) return { error: 'Recipient not found' };

  const customerName = input.customerName.trim();
  if (!customerName) return { error: 'Customer name is required' };

  const phone = normalizePhone(input.contactNo);
  if (!phone.raw) return { error: 'Contact number is required' };

  const telecallerPhone = input.telecallerPhone.trim()
    ? normalizePhone(input.telecallerPhone).e164 ?? input.telecallerPhone.trim()
    : null;

  const { error } = await supabase
    .from('recipients')
    .update({
      customer_name: customerName,
      contact_no: phone.raw,
      contact_no_e164: phone.e164,
      address: input.address.trim() || null,
      product_name: input.productName.trim() || null,
      product_delivery_date: input.productDeliveryDate || null,
      telecaller_name: input.telecallerName.trim() || null,
      telecaller_phone: telecallerPhone,
      missing_address: !input.address.trim(),
      missing_product: !input.productName.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.recipientId);
  if (error) return { error: error.message };

  await logEvent(supabase, {
    recipientId: input.recipientId,
    eventType: 'edit',
    actorType: 'admin',
    actorId: user.id,
    payload: { action: 'details_updated' },
  });

  revalidatePath(`/recipients/${input.recipientId}`);
  revalidatePath('/recipients');
  return { ok: true };
}
