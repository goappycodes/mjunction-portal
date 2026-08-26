'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logEvent, transitionStatus } from '@/lib/domain/audit';
import type { CallType, RecipientStatus } from '@/lib/database.types';

export type AgentState = { error?: string; ok?: boolean };

/**
 * Which half of the pipeline an `issue_raised` recipient was escalated from.
 *
 * Now that every press-2 lands on `issue_raised`, the status alone no longer
 * says whether the caller was reporting a bad address (order phase) or a bad
 * delivery — and the two are resolved by different actions. The most recent
 * call attempt's `call_type` is the record of which script raised it. Falls
 * back to the order phase, which is the earlier half and the safer default:
 * an order escalation resolved wrongly is re-callable, a delivery one closed
 * wrongly is terminal.
 */
export async function escalationPhase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipientId: string,
): Promise<CallType> {
  const { data } = await supabase
    .from('call_attempts')
    .select('call_type')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.call_type as CallType | undefined) ?? 'order_confirmation';
}

/**
 * Resolve an Order-Confirmation escalation (press-2): agent captures the
 * corrected address MANUALLY (per Ritesh's note — no STT) and moves the
 * recipient to address_corrected. Available to telecaller + admin.
 */
export async function resolveOrderEscalation(input: {
  recipientId: string;
  correctedAddress: string;
  note?: string;
  confirmedUnchanged?: boolean;
}): Promise<AgentState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: r } = await supabase
    .from('recipients')
    .select('id, status, preferred_language')
    .eq('id', input.recipientId)
    .single();
  if (!r) return { error: 'Order not found' };
  // `issue_raised` is the normal state for an order escalation now that every
  // press-2 lands there; the other two remain valid entry points for a
  // recipient escalated before that change, or one an agent is fixing up
  // after a retry.
  if (
    r.status !== 'issue_raised' &&
    r.status !== 'order_confirm_pending' &&
    r.status !== 'order_unreachable'
  ) {
    return { error: 'Order is not in an order escalation state' };
  }

  const target = input.confirmedUnchanged ? 'address_confirmed' : 'address_corrected';

  if (!input.confirmedUnchanged) {
    if (!input.correctedAddress.trim()) return { error: 'Corrected address is required' };
    await supabase
      .from('recipients')
      .update({ address: input.correctedAddress.trim(), updated_at: new Date().toISOString() })
      .eq('id', r.id);
  }

  await supabase.from('call_attempts').insert({
    recipient_id: r.id,
    call_type: 'order_confirmation',
    provider: 'mock',
    caller_type: 'agent',
    agent_id: user.id,
    language: r.preferred_language,
    outcome: input.confirmedUnchanged ? 'confirmed' : 'corrected',
    agent_note: input.note ?? null,
  });

  await logEvent(supabase, {
    recipientId: r.id,
    eventType: 'edit',
    actorType: 'agent',
    actorId: user.id,
    payload: {
      action: 'escalation_resolved',
      corrected: !input.confirmedUnchanged,
      note: input.note ?? null,
    },
  });

  await transitionStatus(supabase, {
    recipientId: r.id,
    from: r.status,
    to: target,
    actorType: 'agent',
    actorId: user.id,
  });

  revalidatePath(`/orders/${r.id}`);
  revalidatePath('/queue/escalations');
  return { ok: true };
}

/** Pipeline phase a recipient is in, which decides *which* unreachable applies. */
const ORDER_PHASE: RecipientStatus[] = [
  'imported',
  'order_confirm_pending',
  'order_unreachable',
];

/**
 * Mark a recipient unreachable by hand — the caller could not be connected.
 *
 * The IVR already does this automatically when Exotel reports the call never
 * connected (no-answer / busy / failed → `*_unreachable`, see the engine's
 * status-callback). This is the manual counterpart, for the cases that never
 * produce an Exotel terminal status: an agent dialling from their own phone, a
 * number that rings out on the ops team's side, or a real call whose callback
 * never arrived.
 *
 * Which unreachable status applies is derived from the pipeline phase, not
 * asked for — a recipient awaiting order confirmation can only be
 * `order_unreachable`, one awaiting delivery confirmation only
 * `delivery_unreachable`. Available to telecaller + admin, like the other
 * agent actions.
 */
export async function markUnreachable(input: {
  recipientId: string;
  note?: string;
}): Promise<AgentState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: r } = await supabase
    .from('recipients')
    .select('id, status, preferred_language')
    .eq('id', input.recipientId)
    .single();
  if (!r) return { error: 'Order not found' };

  const isOrderPhase = ORDER_PHASE.includes(r.status);
  const isDeliveryPhase =
    r.status === 'delivery_confirm_pending' || r.status === 'delivery_unreachable';

  if (!isOrderPhase && !isDeliveryPhase) {
    return { error: 'Order is not awaiting a call' };
  }

  const target: RecipientStatus = isOrderPhase ? 'order_unreachable' : 'delivery_unreachable';
  const callType: CallType = isOrderPhase ? 'order_confirmation' : 'delivery_confirmation';

  // Logged as a real (agent-placed) call attempt so it counts in the call log,
  // the VOC/reports view and the dashboard's daily activity — an attempt that
  // failed to connect is still an attempt, and leaving it out would understate
  // the day's calling.
  const { count } = await supabase
    .from('call_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', r.id)
    .eq('call_type', callType);

  await supabase.from('call_attempts').insert({
    recipient_id: r.id,
    call_type: callType,
    attempt_number: (count ?? 0) + 1,
    provider: 'manual',
    caller_type: 'agent',
    agent_id: user.id,
    language: r.preferred_language,
    outcome: 'not_reachable',
    agent_note: input.note?.trim() || null,
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
  });

  await transitionStatus(supabase, {
    recipientId: r.id,
    from: r.status,
    to: target,
    actorType: 'agent',
    actorId: user.id,
    payload: { via: callType, outcome: 'not_reachable', manual: true },
  });

  revalidatePath(`/orders/${r.id}`);
  revalidatePath('/orders');
  revalidatePath('/queue/unreachable');
  return { ok: true };
}

/**
 * Resolve a Delivery issue (press-2 → issue_raised): agent logs handling and
 * closes the recipient. Available to telecaller + admin.
 */
export async function resolveDeliveryIssue(input: {
  recipientId: string;
  note: string;
}): Promise<AgentState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: r } = await supabase
    .from('recipients')
    .select('id, status, preferred_language')
    .eq('id', input.recipientId)
    .single();
  if (!r) return { error: 'Order not found' };
  if (r.status !== 'issue_raised') return { error: 'Order has no open issue' };
  // `issue_raised` is now reachable from the order half too, and closing one of
  // those here would skip the rest of the pipeline entirely.
  if ((await escalationPhase(supabase, r.id)) !== 'delivery_confirmation') {
    return { error: 'This is an order escalation — resolve it with the address form' };
  }
  if (!input.note.trim()) return { error: 'A resolution note is required' };

  await supabase.from('call_attempts').insert({
    recipient_id: r.id,
    call_type: 'delivery_confirmation',
    provider: 'mock',
    caller_type: 'agent',
    agent_id: user.id,
    language: r.preferred_language,
    outcome: 'issue_raised',
    agent_note: input.note.trim(),
  });

  await logEvent(supabase, {
    recipientId: r.id,
    eventType: 'edit',
    actorType: 'agent',
    actorId: user.id,
    payload: { action: 'issue_resolved', note: input.note.trim() },
  });

  await transitionStatus(supabase, {
    recipientId: r.id,
    from: 'issue_raised',
    to: 'closed',
    actorType: 'agent',
    actorId: user.id,
  });

  revalidatePath(`/orders/${r.id}`);
  revalidatePath('/queue/escalations');
  return { ok: true };
}
