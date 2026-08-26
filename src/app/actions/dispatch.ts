'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logEvent, transitionStatus } from '@/lib/domain/audit';
import type { ValidatedDeliveryRow } from '@/lib/domain/bulk-delivery';

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
    .select('id, status')
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

  // No revalidatePath here: the caller patches just the affected row client-side
  // for an instant, flicker-free update. Both /recipients and the detail page
  // are force-dynamic, so they refetch fresh on the next navigation anyway.
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
    .select('id, status')
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

  // See saveDispatch: the row is patched client-side; no full re-render.
  return { ok: true };
}

export type DeliveryMatch = 'matched' | 'not_dispatched' | 'not_found' | 'skipped_status' | 'format_error';

export interface BulkDeliveryRowResult extends ValidatedDeliveryRow {
  match: DeliveryMatch;
  recipientId?: string;
  customerName?: string | null;
}

export interface BulkDeliveryPreview {
  error?: string;
  rows: BulkDeliveryRowResult[];
  counts: Record<DeliveryMatch, number>;
}

/**
 * Match each format-validated row (from lib/domain/bulk-delivery.ts) to a
 * dispatched recipient by Unique Order ID. Read-only —
 * used to render the preview table before the admin commits.
 */
export async function previewBulkDelivery(input: {
  rows: ValidatedDeliveryRow[];
}): Promise<BulkDeliveryPreview> {
  await requireAdmin();
  const supabase = await createClient();

  const uniqueIds = Array.from(
    new Set(input.rows.map((r) => r.unique_id).filter((v): v is string => !!v)),
  );
  const { data: recipients } = uniqueIds.length
    ? await supabase
        .from('recipients')
        .select('id, status, customer_name, unique_id')
        .in('unique_id', uniqueIds)
    : { data: [] };
  const byUniqueId = new Map((recipients ?? []).map((r) => [r.unique_id, r]));

  const counts: Record<DeliveryMatch, number> = {
    matched: 0,
    not_dispatched: 0,
    not_found: 0,
    skipped_status: 0,
    format_error: 0,
  };

  const rows: BulkDeliveryRowResult[] = input.rows.map((row) => {
    let match: DeliveryMatch;
    let recipientId: string | undefined;
    let customerName: string | null | undefined;

    const recipient = row.unique_id ? byUniqueId.get(row.unique_id) : undefined;
    if (row.errors.length) match = 'format_error';
    else if (!row.isDelivered) match = 'skipped_status';
    else if (!recipient) match = 'not_found';
    else if (recipient.status !== 'dispatched') match = 'not_dispatched';
    else match = 'matched';

    if (recipient && match !== 'format_error') {
      recipientId = recipient.id;
      customerName = recipient.customer_name;
    }

    counts[match]++;
    return { ...row, match, recipientId, customerName };
  });

  return { rows, counts };
}

export interface BulkDeliveryCommitResult {
  error?: string;
  updated: number;
  skipped: number;
}

/** Apply markDelivered to every row the preview resolved to a dispatched recipient. */
export async function bulkMarkDelivered(input: {
  rows: { recipientId: string; delivered_date: string }[];
}): Promise<BulkDeliveryCommitResult> {
  await requireAdmin();
  if (!input.rows.length) return { updated: 0, skipped: 0 };

  let updated = 0;
  let skipped = 0;
  for (const row of input.rows) {
    const res = await markDelivered({ recipientId: row.recipientId, delivered_date: row.delivered_date });
    if (res.ok) updated++;
    else skipped++;
  }

  revalidatePath('/recipients');
  revalidatePath('/voc');
  return { updated, skipped };
}
