/**
 * QA test fixtures — one clearly-labelled recipient per status (plus the
 * order-escalation and delivery-issue action states), in a dedicated
 * "QA Test Fixtures" campaign so they're easy to find and don't get lost in
 * the bulk-seeded demo data.
 *
 *   npx tsx supabase/seed/qa-fixtures.ts
 *
 * Not idempotent — re-running will collide on the fixed phone numbers
 * (campaign+phone is unique). To wipe and re-run, delete in this order (
 * `voc_recordings` has no ON DELETE CASCADE, so a straight campaign delete
 * will fail while the "Confirmed" fixture's VOC row exists):
 *   delete from voc_recordings where recipient_id in
 *     (select id from recipients where calling_from = 'QA Test Fixtures');
 *   delete from campaigns where calling_from = 'QA Test Fixtures';
 *     -- cascades recipients -> call_attempts/dispatches/recipient_events/call_records
 * Requires `npm run seed` to have been run at least once already (needs an
 * admin + telecaller profile, and an existing sealed VOC recording to reuse
 * the mock audio file from for the "Confirmed" fixture's Play button).
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

import type { Database, Recipient } from '../../src/lib/database.types';
import { transitionStatus, logEvent } from '../../src/lib/domain/audit';
import { upsertCallRecord } from '../../src/lib/domain/call-records';

loadEnv({ path: '.env.local' });

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const CAMPAIGN_NAME = 'QA Test Fixtures';
const PHONE_BASE = 9799990000;
const today = new Date().toISOString().slice(0, 10);

async function main() {
  const { data: admin } = await db.from('profiles').select('id').eq('role', 'admin').limit(1).single();
  const { data: agent } = await db.from('profiles').select('id').eq('role', 'telecaller').limit(1).single();
  if (!admin || !agent) {
    throw new Error('Need at least one admin and one telecaller profile — run `npm run seed` first.');
  }
  // Captured as plain strings (not `admin.id`) so nested function
  // declarations below don't lose TS's null-narrowing on `admin`/`agent`.
  const adminId = admin.id;
  const agentId = agent.id;

  const { data: existingVoc } = await db
    .from('voc_recordings')
    .select('storage_path, duration_seconds')
    .limit(1)
    .maybeSingle();
  if (!existingVoc) {
    throw new Error('No existing voc_recordings row to reuse a mock audio file from — run `npm run seed` first.');
  }

  let { data: campaign } = await db
    .from('campaigns')
    .select('*')
    .eq('calling_from', CAMPAIGN_NAME)
    .maybeSingle();
  if (!campaign) {
    const { data: created, error } = await db
      .from('campaigns')
      .insert({
        calling_from: CAMPAIGN_NAME,
        order_reference: 'QA-FIXTURES',
        default_language: 'hi',
        created_by: adminId,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    campaign = created;
  }
  const campaignId = campaign.id;

  let phone = PHONE_BASE;

  async function makeRecipient(label: string, product: string): Promise<Recipient> {
    const e164 = `+91${phone++}`;
    const { data, error } = await db
      .from('recipients')
      .insert({
        campaign_id: campaignId,
        calling_from: CAMPAIGN_NAME,
        telecaller_name: 'QA Fixture Agent',
        contact_no: e164.replace('+91', ''),
        contact_no_e164: e164,
        customer_name: label,
        address: '221B Test Street, QA City, QA 000001',
        product_name: product,
        status: 'imported',
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    await logEvent(db, {
      recipientId: data.id,
      eventType: 'imported',
      actorType: 'admin',
      actorId: adminId,
      payload: { fixture: true, calling_from: CAMPAIGN_NAME },
    });
    await upsertCallRecord(db, data.id);
    return data as Recipient;
  }

  async function addCallAttempt(
    r: Recipient,
    callType: 'order_confirmation' | 'delivery_confirmation',
    outcome: string,
  ) {
    await db.from('call_attempts').insert({
      recipient_id: r.id,
      campaign_id: campaignId,
      call_type: callType,
      attempt_number: 1,
      provider: 'mock',
      caller_type: 'ivr',
      language: 'hi',
      outcome: outcome as never,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    });
    await logEvent(db, {
      recipientId: r.id,
      eventType: 'call_attempt',
      actorType: 'ivr',
      payload: { call_type: callType, outcome },
    });
  }

  // 1. imported — eligible for "Run order-confirm batch"; no per-row action.
  await makeRecipient('TEST 01 — Imported', 'Test Product A');

  // 2. order_confirm_pending + active escalation — detail-page address
  // correction actions, and the Escalations queue's "Order" section.
  {
    const r = await makeRecipient('TEST 02 — Order Escalation (Pending)', 'Test Product B');
    await transitionStatus(db, { recipientId: r.id, from: 'imported', to: 'order_confirm_pending', actorType: 'system' });
    await addCallAttempt(r, 'order_confirmation', 'transferred_to_agent');
    await upsertCallRecord(db, r.id);
  }

  // 3. address_confirmed — "Dispatch" button.
  {
    const r = await makeRecipient('TEST 03 — Address Confirmed', 'Test Product C');
    await transitionStatus(db, { recipientId: r.id, from: 'imported', to: 'order_confirm_pending', actorType: 'system' });
    await transitionStatus(db, { recipientId: r.id, from: 'order_confirm_pending', to: 'address_confirmed', actorType: 'ivr' });
    await upsertCallRecord(db, r.id);
  }

  // 4. address_corrected — "Dispatch" button (agent-corrected path).
  {
    const r = await makeRecipient('TEST 04 — Address Corrected', 'Test Product D');
    await transitionStatus(db, { recipientId: r.id, from: 'imported', to: 'order_confirm_pending', actorType: 'system' });
    await db
      .from('recipients')
      .update({ address: '42 Corrected Lane, QA City, QA 000002', updated_at: new Date().toISOString() })
      .eq('id', r.id);
    await transitionStatus(db, {
      recipientId: r.id,
      from: 'order_confirm_pending',
      to: 'address_corrected',
      actorType: 'agent',
      actorId: agentId,
    });
    await upsertCallRecord(db, r.id);
  }

  // 5. order_unreachable — detail-page "Retry call"; Unreachable queue.
  {
    const r = await makeRecipient('TEST 05 — Order Unreachable', 'Test Product E');
    await transitionStatus(db, { recipientId: r.id, from: 'imported', to: 'order_confirm_pending', actorType: 'system' });
    await addCallAttempt(r, 'order_confirmation', 'no_answer');
    await transitionStatus(db, { recipientId: r.id, from: 'order_confirm_pending', to: 'order_unreachable', actorType: 'ivr' });
    await upsertCallRecord(db, r.id);
  }

  // 6. dispatched — "Mark as delivered" button.
  {
    const r = await makeRecipient('TEST 06 — Dispatched', 'Test Product F');
    await transitionStatus(db, { recipientId: r.id, from: 'imported', to: 'order_confirm_pending', actorType: 'system' });
    await transitionStatus(db, { recipientId: r.id, from: 'order_confirm_pending', to: 'address_confirmed', actorType: 'ivr' });
    await db.from('dispatches').insert({
      recipient_id: r.id,
      courier_name: 'Delhivery',
      awb_number: 'QAFIX000006',
      dispatch_date: today,
      created_by: adminId,
    });
    await transitionStatus(db, { recipientId: r.id, from: 'address_confirmed', to: 'dispatched', actorType: 'admin', actorId: adminId });
    await upsertCallRecord(db, r.id);
  }

  // Shared helper for the delivery-side fixtures (7–11), which all pass
  // through dispatched -> delivered -> delivery_confirm_pending first.
  async function throughDeliveryConfirmPending(label: string, product: string, awb: string) {
    const r = await makeRecipient(label, product);
    await transitionStatus(db, { recipientId: r.id, from: 'imported', to: 'order_confirm_pending', actorType: 'system' });
    await transitionStatus(db, { recipientId: r.id, from: 'order_confirm_pending', to: 'address_confirmed', actorType: 'ivr' });
    await db.from('dispatches').insert({
      recipient_id: r.id,
      courier_name: 'Blue Dart',
      awb_number: awb,
      dispatch_date: today,
      delivered_date: today,
      created_by: adminId,
    });
    await transitionStatus(db, { recipientId: r.id, from: 'address_confirmed', to: 'dispatched', actorType: 'admin', actorId: adminId });
    await transitionStatus(db, { recipientId: r.id, from: 'dispatched', to: 'delivered', actorType: 'admin', actorId: adminId });
    await transitionStatus(db, { recipientId: r.id, from: 'delivered', to: 'delivery_confirm_pending', actorType: 'system' });
    await upsertCallRecord(db, r.id);
    return r;
  }

  // 7. delivered — transient/display-only status (no action button); parked
  // one step before the auto-enqueue so the badge is genuinely visible.
  {
    const r = await makeRecipient('TEST 07 — Delivered (display only)', 'Test Product G');
    await transitionStatus(db, { recipientId: r.id, from: 'imported', to: 'order_confirm_pending', actorType: 'system' });
    await transitionStatus(db, { recipientId: r.id, from: 'order_confirm_pending', to: 'address_confirmed', actorType: 'ivr' });
    await db.from('dispatches').insert({
      recipient_id: r.id,
      courier_name: 'Ekart',
      awb_number: 'QAFIX000007',
      dispatch_date: today,
      delivered_date: today,
      created_by: adminId,
    });
    await transitionStatus(db, { recipientId: r.id, from: 'address_confirmed', to: 'dispatched', actorType: 'admin', actorId: adminId });
    await transitionStatus(db, { recipientId: r.id, from: 'dispatched', to: 'delivered', actorType: 'admin', actorId: adminId });
    await upsertCallRecord(db, r.id);
  }

  // 8. delivery_confirm_pending — "Run confirmation call" button.
  await throughDeliveryConfirmPending('TEST 08 — Delivery Confirm Pending', 'Test Product H', 'QAFIX000008');

  // 9. confirmed — VOC sealed; VOC & Reports "Play" button (reuses an
  // existing mock WAV storage object so playback actually works).
  {
    const r = await throughDeliveryConfirmPending('TEST 09 — Confirmed (VOC sealed)', 'Test Product I', 'QAFIX000009');
    const { data: attempt } = await db
      .from('call_attempts')
      .insert({
        recipient_id: r.id,
        campaign_id: campaignId,
        call_type: 'delivery_confirmation',
        attempt_number: 1,
        provider: 'mock',
        caller_type: 'ivr',
        language: 'hi',
        outcome: 'confirmed',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    await db.from('voc_recordings').insert({
      sealed_voc_id: `VOC-QAFIX-${r.id.slice(0, 8).toUpperCase()}`,
      recipient_id: r.id,
      campaign_id: campaignId,
      call_attempt_id: attempt!.id,
      call_type: 'delivery_confirmation',
      product_name: 'Test Product I',
      caller_type: 'ivr',
      language: 'hi',
      dtmf_outcome: '1',
      storage_path: existingVoc.storage_path,
      duration_seconds: existingVoc.duration_seconds,
    });
    await logEvent(db, {
      recipientId: r.id,
      eventType: 'voc_sealed',
      actorType: 'ivr',
      payload: { sealed_voc_id: `VOC-QAFIX-${r.id.slice(0, 8).toUpperCase()}`, language: 'hi' },
    });
    await transitionStatus(db, { recipientId: r.id, from: 'delivery_confirm_pending', to: 'confirmed', actorType: 'ivr' });
    await upsertCallRecord(db, r.id);
  }

  // 10. issue_raised — "Resolve & close" button; Escalations queue's
  // "Delivery — issue raised" section.
  {
    const r = await throughDeliveryConfirmPending('TEST 10 — Issue Raised', 'Test Product J', 'QAFIX000010');
    await addCallAttempt(r, 'delivery_confirmation', 'issue_raised');
    await transitionStatus(db, { recipientId: r.id, from: 'delivery_confirm_pending', to: 'issue_raised', actorType: 'ivr' });
    await upsertCallRecord(db, r.id);
  }

  // 11. delivery_unreachable — "Run confirmation call" row action + detail
  // "Retry call"; Unreachable queue's "Delivery" section.
  {
    const r = await throughDeliveryConfirmPending('TEST 11 — Delivery Unreachable', 'Test Product K', 'QAFIX000011');
    await addCallAttempt(r, 'delivery_confirmation', 'not_reachable');
    await transitionStatus(db, { recipientId: r.id, from: 'delivery_confirm_pending', to: 'delivery_unreachable', actorType: 'ivr' });
    await upsertCallRecord(db, r.id);
  }

  // 12. closed — final state, reached here via a resolved delivery issue.
  {
    const r = await throughDeliveryConfirmPending('TEST 12 — Closed', 'Test Product L', 'QAFIX000012');
    await addCallAttempt(r, 'delivery_confirmation', 'issue_raised');
    await transitionStatus(db, { recipientId: r.id, from: 'delivery_confirm_pending', to: 'issue_raised', actorType: 'ivr' });
    await logEvent(db, {
      recipientId: r.id,
      eventType: 'edit',
      actorType: 'agent',
      actorId: agentId,
      payload: { action: 'issue_resolved', note: 'QA fixture — pre-resolved and closed.' },
    });
    await transitionStatus(db, { recipientId: r.id, from: 'issue_raised', to: 'closed', actorType: 'agent', actorId: agentId });
    await upsertCallRecord(db, r.id);
  }

  console.log(`QA fixtures ready in campaign "${CAMPAIGN_NAME}" (${campaignId}).`);
  console.log('See the file header for how to wipe and re-run.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
