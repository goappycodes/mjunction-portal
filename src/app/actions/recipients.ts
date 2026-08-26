'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/domain/audit';
import { normalizePhone } from '@/lib/domain/phone';
import { ALL_STATUSES } from '@/lib/domain/status';
import type { RecipientStatus } from '@/lib/database.types';

export type UpdateRecipientState = { error?: string; ok?: boolean };

export interface UpdateRecipientInput {
  recipientId: string;
  customerName: string;
  contactNo: string;
  email?: string;
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
  if (!existing) return { error: 'Order not found' };

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
      email: input.email?.trim() || null,
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

  revalidatePath(`/orders/${input.recipientId}`);
  revalidatePath('/orders');
  return { ok: true };
}

/**
 * Admin-only manual status override.
 *
 * Deliberately bypasses the status machine (`canTransition`) and sets any
 * status directly. That is the entire point of this control: it exists to
 * rescue a recipient that is *already* in the wrong state — a bad import, a
 * call finalized against the wrong row, a status nudged by hand in the DB —
 * and by definition those are the moves the machine refuses. Every other write
 * path in the app still goes through `transitionStatus` and stays validated.
 *
 * The audit trail is what makes this safe to have: the timeline event is
 * marked `manual_override` and carries the admin's id, so a hand-set status is
 * always distinguishable from one the pipeline produced.
 */
export async function updateRecipientStatus(input: {
  recipientId: string;
  status: RecipientStatus;
  note?: string;
}): Promise<UpdateRecipientState> {
  const user = await requireAdmin();
  const supabase = await createClient();

  if (!ALL_STATUSES.includes(input.status)) {
    return { error: `Unknown status: ${input.status}` };
  }

  const { data: r } = await supabase
    .from('recipients')
    .select('id, status')
    .eq('id', input.recipientId)
    .single();
  if (!r) return { error: 'Order not found' };
  if (r.status === input.status) return { ok: true };

  const { error } = await supabase
    .from('recipients')
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq('id', input.recipientId);
  if (error) return { error: error.message };

  // Written as a `status_change` so it appears in the timeline alongside every
  // automatic transition, rather than as a separate event type the timeline
  // renderer would not know how to show.
  await logEvent(supabase, {
    recipientId: input.recipientId,
    eventType: 'status_change',
    actorType: 'admin',
    actorId: user.id,
    payload: {
      from: r.status,
      to: input.status,
      manual_override: true,
      note: input.note?.trim() || null,
    },
  });

  revalidatePath(`/orders/${input.recipientId}`);
  revalidatePath('/orders');
  revalidatePath('/queue/escalations');
  revalidatePath('/queue/unreachable');
  return { ok: true };
}
