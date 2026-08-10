import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type DB = SupabaseClient<Database>;

/**
 * Recompute and upsert the call_records row for one recipient from the
 * current state of recipients/dispatches/voc_recordings/call_attempts.
 * Call this after any mutation that changes what VOC & Reports should show
 * (import, a call attempt, dispatch/delivery, an agent edit) — the page
 * itself only ever reads call_records, it never re-derives this.
 */
export async function upsertCallRecord(db: DB, recipientId: string): Promise<void> {
  const { data: recipient } = await db
    .from('recipients')
    .select(
      'id, campaign_id, customer_name, contact_no_e164, telecaller_name, product_name, status, preferred_language',
    )
    .eq('id', recipientId)
    .single();
  if (!recipient) return;

  const [{ data: dispatch }, { data: voc }, { data: orderCall }] = await Promise.all([
    db
      .from('dispatches')
      .select('dispatch_date, delivered_date')
      .eq('recipient_id', recipientId)
      .maybeSingle(),
    db
      .from('voc_recordings')
      .select('id, sealed_voc_id, dtmf_outcome, duration_seconds, created_at')
      .eq('recipient_id', recipientId)
      .maybeSingle(),
    db
      .from('call_attempts')
      .select('ended_at')
      .eq('recipient_id', recipientId)
      .eq('call_type', 'order_confirmation')
      .eq('outcome', 'confirmed')
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  await db.from('call_records').upsert(
    {
      recipient_id: recipient.id,
      campaign_id: recipient.campaign_id,
      customer_name: recipient.customer_name,
      contact_no_e164: recipient.contact_no_e164,
      telecaller_name: recipient.telecaller_name,
      product_name: recipient.product_name,
      status: recipient.status,
      language: recipient.preferred_language,
      order_confirmed_at: orderCall?.ended_at ?? null,
      dispatched_date: dispatch?.dispatch_date ?? null,
      delivered_date: dispatch?.delivered_date ?? null,
      delivery_confirmed_at: voc?.created_at ?? null,
      sealed_voc_id: voc?.sealed_voc_id ?? null,
      voc_recording_id: voc?.id ?? null,
      dtmf_outcome: voc?.dtmf_outcome ?? null,
      duration_seconds: voc?.duration_seconds ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'recipient_id' },
  );
}
