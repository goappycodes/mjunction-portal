'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logEvent, transitionStatus } from '@/lib/domain/audit';
import { normalizePhone } from '@/lib/domain/phone';
import type { RecipientStatus } from '@/lib/database.types';

const BULK_MAX = 2000;
const DISPATCHABLE: RecipientStatus[] = ['address_confirmed', 'address_corrected'];

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

  // See saveDispatch: the row is patched client-side; no full re-render.
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Bulk import: dispatch / delivery status from an uploaded file.      */
/* ------------------------------------------------------------------ */

export interface BulkResult {
  error?: string;
  updated: number;
  skipped: { contact: string; reason: string }[];
}

export interface BulkDispatchRow {
  unique_id?: string;
  contact_no?: string;
  courier_name: string;
  awb_number: string;
  dispatch_date: string;
}

export interface BulkDeliverRow {
  unique_id?: string;
  contact_no?: string;
  delivered_date: string;
}

/**
 * Resolve how a bulk row targets a recipient: by `unique_id` when supplied,
 * otherwise by phone (E.164). `ref` is a human-readable label for reporting.
 */
function resolveMatch(row: { unique_id?: string; contact_no?: string }):
  | { ok: true; ref: string; column: 'unique_id' | 'contact_no_e164'; value: string }
  | { ok: false; ref: string; error: string } {
  const uid = row.unique_id?.trim();
  if (uid) return { ok: true, ref: uid, column: 'unique_id', value: uid };
  const e164 = normalizePhone(row.contact_no).e164;
  if (!e164) return { ok: false, ref: row.contact_no || '(blank)', error: 'Missing unique id and invalid phone' };
  return { ok: true, ref: e164, column: 'contact_no_e164', value: e164 };
}

/**
 * Bulk-mark recipients as dispatched from an imported file. Each row is matched
 * to an address-confirmed recipient by phone (E.164), optionally scoped to a
 * campaign. Rows that don't match an eligible recipient are reported back.
 */
export async function bulkDispatch(input: {
  campaignId?: string;
  rows: BulkDispatchRow[];
}): Promise<BulkResult> {
  const user = await requireAdmin();
  if (input.rows.length > BULK_MAX) {
    return { error: `Too many rows (max ${BULK_MAX}).`, updated: 0, skipped: [] };
  }
  const supabase = await createClient();
  const skipped: BulkResult['skipped'] = [];
  let updated = 0;

  for (const row of input.rows) {
    const m = resolveMatch(row);
    if (!m.ok) {
      skipped.push({ contact: m.ref, reason: m.error });
      continue;
    }
    if (!row.courier_name || !row.awb_number || !row.dispatch_date) {
      skipped.push({ contact: m.ref, reason: 'Missing delivery partner / AWB / dispatch date' });
      continue;
    }

    let q = supabase.from('recipients').select('id, status').eq(m.column, m.value).in('status', DISPATCHABLE);
    if (input.campaignId) q = q.eq('campaign_id', input.campaignId);
    const { data: recs } = await q;
    if (!recs?.length) {
      skipped.push({ contact: m.ref, reason: 'No address-confirmed recipient found' });
      continue;
    }

    for (const r of recs) {
      try {
        await supabase.from('dispatches').upsert(
          {
            recipient_id: r.id,
            courier_name: row.courier_name,
            awb_number: row.awb_number,
            dispatch_date: row.dispatch_date,
            created_by: user.id,
          },
          { onConflict: 'recipient_id' },
        );
        await transitionStatus(supabase, {
          recipientId: r.id,
          from: r.status,
          to: 'dispatched',
          actorType: 'admin',
          actorId: user.id,
          payload: { courier: row.courier_name, awb: row.awb_number, via: 'bulk_import' },
        });
        updated++;
      } catch (e) {
        skipped.push({ contact: m.ref, reason: e instanceof Error ? e.message : 'Update failed' });
      }
    }
  }

  return { updated, skipped };
}

/**
 * Bulk-mark dispatched recipients as delivered from an imported file. Matches a
 * dispatched recipient by unique id (or phone), records the delivery date, and
 * auto-enqueues the delivery-confirmation call (-> delivery_confirm_pending).
 */
export async function bulkDeliver(input: {
  campaignId?: string;
  rows: BulkDeliverRow[];
}): Promise<BulkResult> {
  const user = await requireAdmin();
  if (input.rows.length > BULK_MAX) {
    return { error: `Too many rows (max ${BULK_MAX}).`, updated: 0, skipped: [] };
  }
  const supabase = await createClient();
  const skipped: BulkResult['skipped'] = [];
  let updated = 0;

  for (const row of input.rows) {
    const m = resolveMatch(row);
    if (!m.ok) {
      skipped.push({ contact: m.ref, reason: m.error });
      continue;
    }
    if (!row.delivered_date) {
      skipped.push({ contact: m.ref, reason: 'Missing delivery date' });
      continue;
    }

    let q = supabase.from('recipients').select('id, status').eq(m.column, m.value).eq('status', 'dispatched');
    if (input.campaignId) q = q.eq('campaign_id', input.campaignId);
    const { data: recs } = await q;
    if (!recs?.length) {
      skipped.push({ contact: m.ref, reason: 'No dispatched recipient found' });
      continue;
    }

    for (const r of recs) {
      try {
        await supabase
          .from('dispatches')
          .update({ delivered_date: row.delivered_date })
          .eq('recipient_id', r.id);
        await transitionStatus(supabase, {
          recipientId: r.id,
          from: 'dispatched',
          to: 'delivered',
          actorType: 'admin',
          actorId: user.id,
          payload: { delivered_date: row.delivered_date, via: 'bulk_import' },
        });
        await transitionStatus(supabase, {
          recipientId: r.id,
          from: 'delivered',
          to: 'delivery_confirm_pending',
          actorType: 'system',
        });
        updated++;
      } catch (e) {
        skipped.push({ contact: m.ref, reason: e instanceof Error ? e.message : 'Update failed' });
      }
    }
  }

  return { updated, skipped };
}
