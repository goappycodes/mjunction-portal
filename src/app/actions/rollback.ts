'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/domain/audit';
import { ORDER_ROLLBACK_ENABLED } from '@/lib/env';
import { getRollbackTargets } from '@/lib/domain/rollback';
import type { RecipientStatus } from '@/lib/database.types';

export type RollbackState = { error?: string; ok?: boolean };

/**
 * Dev/test-only tool: force a recipient (order) back to an earlier pipeline
 * status and wipe everything recorded since it was last in that status — call
 * attempts, dispatch/VOC records, and timeline events. This bypasses the
 * normal status machine (see lib/domain/status.ts) on purpose, so it must
 * never be reachable in production: gated by ENABLE_ORDER_ROLLBACK, checked
 * here independently of whether the UI button is shown.
 */
export async function rollbackOrder(input: {
  recipientId: string;
  targetStatus: RecipientStatus;
}): Promise<RollbackState> {
  if (!ORDER_ROLLBACK_ENABLED) {
    return { error: 'Order rollback is disabled in this environment' };
  }
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: r } = await supabase
    .from('recipients')
    .select('id, status, created_at')
    .eq('id', input.recipientId)
    .single();
  if (!r) return { error: 'Recipient not found' };

  const allowedTargets = getRollbackTargets(r.status);
  if (!allowedTargets.includes(input.targetStatus)) {
    return { error: `Cannot roll back from ${r.status} to ${input.targetStatus}` };
  }

  const { data: events } = await supabase
    .from('recipient_events')
    .select('id, event_type, payload, created_at')
    .eq('recipient_id', r.id)
    .order('created_at', { ascending: true });

  const cutoffEvent =
    input.targetStatus === 'imported'
      ? (events ?? []).find((e) => e.event_type === 'imported')
      : [...(events ?? [])]
          .reverse()
          .find((e) => e.event_type === 'status_change' && (e.payload as Record<string, unknown>)?.to === input.targetStatus);
  const cutoff = cutoffEvent?.created_at ?? r.created_at;

  const service = createServiceClient();
  const { data: staleVoc } = await supabase
    .from('voc_recordings')
    .select('id, storage_path')
    .eq('recipient_id', r.id)
    .gt('created_at', cutoff);
  if (staleVoc?.length) {
    // Only bucket-hosted recordings have an object to delete. A VOC sealed
    // from a real Exotel call stores the provider's own URL instead — that
    // audio lives on Exotel and is not ours to remove.
    const bucketPaths = staleVoc
      .map((v) => v.storage_path)
      .filter((p) => !/^https?:\/\//i.test(p));
    if (bucketPaths.length) await service.storage.from('voc').remove(bucketPaths);
    await supabase
      .from('voc_recordings')
      .delete()
      .in('id', staleVoc.map((v) => v.id));
  }

  await supabase.from('call_attempts').delete().eq('recipient_id', r.id).gt('created_at', cutoff);
  await supabase.from('dispatches').delete().eq('recipient_id', r.id).gt('created_at', cutoff);
  await supabase.from('recipient_events').delete().eq('recipient_id', r.id).gt('created_at', cutoff);

  const { error: updateErr } = await supabase
    .from('recipients')
    .update({ status: input.targetStatus, updated_at: new Date().toISOString() })
    .eq('id', r.id);
  if (updateErr) return { error: updateErr.message };

  await logEvent(supabase, {
    recipientId: r.id,
    eventType: 'rollback',
    actorType: 'admin',
    actorId: user.id,
    payload: { from: r.status, to: input.targetStatus },
  });

  revalidatePath(`/recipients/${r.id}`);
  revalidatePath('/recipients');
  return { ok: true };
}
