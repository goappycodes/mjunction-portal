import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, RecipientStatus } from '@/lib/database.types';
import { canTransition } from './status';

type DB = SupabaseClient<Database>;

export type ActorType = 'system' | 'ivr' | 'agent' | 'admin';

/** Append a row to the per-recipient timeline. */
export async function logEvent(
  db: DB,
  params: {
    recipientId: string;
    eventType: string;
    actorType: ActorType;
    actorId?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  await db.from('recipient_events').insert({
    recipient_id: params.recipientId,
    event_type: params.eventType,
    actor_type: params.actorType,
    actor_id: params.actorId ?? null,
    payload: (params.payload ?? {}) as unknown as import('@/lib/database.types').Json,
  });
}

/**
 * Validate + apply a status transition, updating recipients.status and
 * writing a 'status_change' timeline event. Throws on an illegal transition.
 */
export async function transitionStatus(
  db: DB,
  params: {
    recipientId: string;
    from: RecipientStatus;
    to: RecipientStatus;
    actorType: ActorType;
    actorId?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  if (!canTransition(params.from, params.to)) {
    throw new Error(
      `Illegal status transition: ${params.from} -> ${params.to}`,
    );
  }
  if (params.from === params.to) return;

  const { error } = await db
    .from('recipients')
    .update({ status: params.to, updated_at: new Date().toISOString() })
    .eq('id', params.recipientId);
  if (error) throw new Error(error.message);

  await logEvent(db, {
    recipientId: params.recipientId,
    eventType: 'status_change',
    actorType: params.actorType,
    actorId: params.actorId,
    payload: { from: params.from, to: params.to, ...(params.payload ?? {}) },
  });
}
