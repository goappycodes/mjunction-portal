'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logEvent, transitionStatus } from '@/lib/domain/audit';
import { upsertCallRecord } from '@/lib/domain/call-records';

export type AgentState = { error?: string; ok?: boolean };

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
    .select('id, status, campaign_id, preferred_language')
    .eq('id', input.recipientId)
    .single();
  if (!r) return { error: 'Recipient not found' };
  if (r.status !== 'order_confirm_pending' && r.status !== 'order_unreachable') {
    return { error: 'Recipient is not in an order escalation state' };
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
    campaign_id: r.campaign_id,
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
  await upsertCallRecord(supabase, r.id);

  revalidatePath(`/recipients/${r.id}`);
  revalidatePath('/queue/escalations');
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
    .select('id, status, campaign_id, preferred_language')
    .eq('id', input.recipientId)
    .single();
  if (!r) return { error: 'Recipient not found' };
  if (r.status !== 'issue_raised') return { error: 'Recipient has no open issue' };
  if (!input.note.trim()) return { error: 'A resolution note is required' };

  await supabase.from('call_attempts').insert({
    recipient_id: r.id,
    campaign_id: r.campaign_id,
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
  await upsertCallRecord(supabase, r.id);

  revalidatePath(`/recipients/${r.id}`);
  revalidatePath('/queue/escalations');
  return { ok: true };
}
