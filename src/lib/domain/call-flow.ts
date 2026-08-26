import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  LanguageSource,
  Recipient,
  RecipientStatus,
} from '@/lib/database.types';
import type { PlaceCallResult } from '@/lib/telephony/types';
import { logEvent, transitionStatus, type ActorType } from './audit';
import { deliveryConfirmationStatusFor, orderConfirmationStatusFor } from './status';

type DB = SupabaseClient<Database>;

function langSource(result: PlaceCallResult): LanguageSource {
  return result.languageDefaulted ? 'defaulted' : 'recipient_selected';
}

function sealedVocId(): string {
  const now = new Date();
  const stamp =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 1e6)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  return `VOC-${stamp}-${rand}`;
}

interface RecordContext {
  actorType: ActorType;
  actorId?: string | null;
  callerType?: 'ivr' | 'agent';
  agentId?: string | null;
  agentNote?: string | null;
}

/**
 * Persist the result of an Order-Confirmation call: writes call_attempts,
 * stores the chosen language on the recipient, advances status per outcome,
 * and appends timeline events. Shared by the batch runner and the seed.
 */
export async function recordOrderConfirmationCall(
  db: DB,
  recipient: Recipient,
  result: PlaceCallResult,
  attemptNumber: number,
  ctx: RecordContext,
) {
  let from: RecipientStatus = recipient.status;

  // Ensure the recipient is enqueued before applying an outcome.
  if (from === 'imported') {
    await transitionStatus(db, {
      recipientId: recipient.id,
      from,
      to: 'order_confirm_pending',
      actorType: 'system',
    });
    from = 'order_confirm_pending';
  }

  const { data: attempt } = await db
    .from('call_attempts')
    .insert({
      recipient_id: recipient.id,
      call_type: 'order_confirmation',
      attempt_number: attemptNumber,
      provider: process.env.TELEPHONY_PROVIDER ?? 'mock',
      caller_type: ctx.callerType ?? 'ivr',
      agent_id: ctx.agentId ?? null,
      language: result.language,
      language_defaulted: result.languageDefaulted,
      dtmf_response: result.dtmfResponse,
      outcome: result.outcome,
      agent_note: ctx.agentNote ?? null,
      started_at: result.startedAt,
      ended_at: result.endedAt,
    })
    .select('id')
    .single();

  // Persist chosen language on the recipient (reused on later calls).
  await db
    .from('recipients')
    .update({
      preferred_language: result.language,
      language_source: langSource(result),
      updated_at: new Date().toISOString(),
    })
    .eq('id', recipient.id);

  await logEvent(db, {
    recipientId: recipient.id,
    eventType: 'call_attempt',
    actorType: ctx.actorType,
    actorId: ctx.actorId,
    payload: {
      call_type: 'order_confirmation',
      attempt_number: attemptNumber,
      language: result.language,
      language_defaulted: result.languageDefaulted,
      dtmf: result.dtmfResponse,
      outcome: result.outcome,
      caller_type: ctx.callerType ?? 'ivr',
    },
  });

  const to = orderConfirmationStatusFor(result.outcome, from);

  if (to !== from) {
    await transitionStatus(db, {
      recipientId: recipient.id,
      from,
      to,
      actorType: ctx.actorType,
      actorId: ctx.actorId,
      payload: { via: 'order_confirmation', outcome: result.outcome },
    });
  }

  return { attemptId: attempt?.id ?? null, outcome: result.outcome, statusTo: to };
}

/**
 * Persist the result of a Delivery-Confirmation call: writes call_attempts,
 * seals a VOC on confirm, advances status, and appends timeline events.
 */
export async function recordDeliveryConfirmationCall(
  db: DB,
  recipient: Recipient,
  result: PlaceCallResult,
  attemptNumber: number,
  ctx: RecordContext,
) {
  const from: RecipientStatus = recipient.status;

  const { data: attempt } = await db
    .from('call_attempts')
    .insert({
      recipient_id: recipient.id,
      call_type: 'delivery_confirmation',
      attempt_number: attemptNumber,
      provider: process.env.TELEPHONY_PROVIDER ?? 'mock',
      caller_type: ctx.callerType ?? 'ivr',
      agent_id: ctx.agentId ?? null,
      language: result.language,
      language_defaulted: result.languageDefaulted,
      dtmf_response: result.dtmfResponse,
      outcome: result.outcome,
      agent_note: ctx.agentNote ?? null,
      started_at: result.startedAt,
      ended_at: result.endedAt,
    })
    .select('id')
    .single();

  await db
    .from('recipients')
    .update({
      preferred_language: result.language,
      language_source: recipient.language_source ?? langSource(result),
      updated_at: new Date().toISOString(),
    })
    .eq('id', recipient.id);

  await logEvent(db, {
    recipientId: recipient.id,
    eventType: 'call_attempt',
    actorType: ctx.actorType,
    actorId: ctx.actorId,
    payload: {
      call_type: 'delivery_confirmation',
      attempt_number: attemptNumber,
      language: result.language,
      language_defaulted: result.languageDefaulted,
      dtmf: result.dtmfResponse,
      outcome: result.outcome,
      caller_type: ctx.callerType ?? 'ivr',
    },
  });

  const to: RecipientStatus = deliveryConfirmationStatusFor(result.outcome, from);
  let sealedVoc: string | null = null;

  if (result.outcome === 'confirmed') {
    // Seal a VOC (recording exists for answered calls).
    if (attempt?.id && result.recording) {
      sealedVoc = sealedVocId();
      await db.from('voc_recordings').insert({
        sealed_voc_id: sealedVoc,
        recipient_id: recipient.id,
        call_attempt_id: attempt.id,
        call_type: 'delivery_confirmation',
        product_name: recipient.product_name,
        caller_type: ctx.callerType ?? 'ivr',
        language: result.language,
        dtmf_outcome: result.dtmfResponse,
        storage_path: result.recording.storagePath,
        duration_seconds: result.recording.durationSeconds,
      });
      await logEvent(db, {
        recipientId: recipient.id,
        eventType: 'voc_sealed',
        actorType: ctx.actorType,
        actorId: ctx.actorId,
        payload: { sealed_voc_id: sealedVoc, language: result.language },
      });
    }
  }

  if (to !== from) {
    await transitionStatus(db, {
      recipientId: recipient.id,
      from,
      to,
      actorType: ctx.actorType,
      actorId: ctx.actorId,
      payload: { via: 'delivery_confirmation', outcome: result.outcome },
    });
  }

  return { attemptId: attempt?.id ?? null, outcome: result.outcome, statusTo: to, sealedVoc };
}
