'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logEvent, transitionStatus } from '@/lib/domain/audit';

const dispatchSchema = z.object({
  recipientId: z.string().uuid(),
  courier_name: z.string().min(1, 'Courier name required'),
  awb_number: z.string().min(1, 'AWB number required'),
  dispatch_date: z.string().min(1, 'Dispatch date required'),
});

export type DispatchState = { error?: string; ok?: boolean };

/** Record a manual dispatch and move the recipient to `dispatched`. */
export async function saveDispatch(input: {
  recipientId: string;
  courier_name: string;
  awb_number: string;
  dispatch_date: string;
}): Promise<DispatchState> {
  const user = await requireAdmin();
  const parsed = dispatchSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { data: r } = await supabase
    .from('recipients')
    .select('id, status, campaign_id')
    .eq('id', input.recipientId)
    .single();
  if (!r) return { error: 'Recipient not found' };

  const { error } = await supabase.from('dispatches').upsert(
    {
      recipient_id: input.recipientId,
      courier_name: parsed.data.courier_name,
      awb_number: parsed.data.awb_number,
      dispatch_date: parsed.data.dispatch_date,
      created_by: user.id,
    },
    { onConflict: 'recipient_id' },
  );
  if (error) return { error: error.message };

  if (r.status === 'address_confirmed' || r.status === 'address_corrected') {
    await transitionStatus(supabase, {
      recipientId: r.id,
      from: r.status,
      to: 'dispatched',
      actorType: 'admin',
      actorId: user.id,
      payload: { courier: parsed.data.courier_name, awb: parsed.data.awb_number },
    });
  }
  await logEvent(supabase, {
    recipientId: r.id,
    eventType: 'dispatch',
    actorType: 'admin',
    actorId: user.id,
    payload: { stage: 'dispatched', courier: parsed.data.courier_name },
  });

  revalidatePath(`/campaigns/${r.campaign_id}/dispatch`);
  revalidatePath(`/recipients/${r.id}`);
  return { ok: true };
}

/**
 * Mark a dispatched recipient as delivered. Auto-enqueues them for the
 * delivery-confirmation call (status -> delivery_confirm_pending).
 */
export async function markDelivered(input: {
  recipientId: string;
  delivered_date: string;
}): Promise<DispatchState> {
  const user = await requireAdmin();
  if (!input.delivered_date) return { error: 'Delivered date required' };

  const supabase = await createClient();
  const { data: r } = await supabase
    .from('recipients')
    .select('id, status, campaign_id')
    .eq('id', input.recipientId)
    .single();
  if (!r) return { error: 'Recipient not found' };
  if (r.status !== 'dispatched') return { error: 'Recipient is not in a dispatched state' };

  await supabase
    .from('dispatches')
    .update({ delivered_date: input.delivered_date })
    .eq('recipient_id', r.id);

  await transitionStatus(supabase, {
    recipientId: r.id,
    from: 'dispatched',
    to: 'delivered',
    actorType: 'admin',
    actorId: user.id,
    payload: { delivered_date: input.delivered_date },
  });
  await logEvent(supabase, {
    recipientId: r.id,
    eventType: 'dispatch',
    actorType: 'admin',
    actorId: user.id,
    payload: { stage: 'delivered', delivered_date: input.delivered_date },
  });
  // Auto-enqueue for delivery confirmation.
  await transitionStatus(supabase, {
    recipientId: r.id,
    from: 'delivered',
    to: 'delivery_confirm_pending',
    actorType: 'system',
  });

  revalidatePath(`/campaigns/${r.campaign_id}/dispatch`);
  revalidatePath(`/recipients/${r.id}`);
  return { ok: true };
}
