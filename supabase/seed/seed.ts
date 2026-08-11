/**
 * Minimal test seed.
 *   npm run seed
 *
 * Creates the admin/telecaller login users and exactly one campaign with one
 * recipient (+917872944208, unique_id ORD-TEST-0001, status `imported`) —
 * fresh and ready to test the "Call Now" order-confirmation flow against a
 * real number. Idempotent: wipes prior demo campaigns first.
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

import type { Campaign, Database, Recipient } from '../../src/lib/database.types';
import { logEvent } from '../../src/lib/domain/audit';

loadEnv({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_PHONE = '+917872944208';
const TEST_UNIQUE_ID = 'ORD-TEST-0001';

const USERS = [
  { email: 'admin@mjunction.test', password: 'Admin@12345', full_name: 'Priya Admin', role: 'admin' as const },
  { email: 'mjunction@appycodes.com', password: 'Admin@12345', full_name: 'mjunction Admin', role: 'admin' as const },
  { email: 'agent@mjunction.test', password: 'Agent@12345', full_name: 'Ravi Telecaller', role: 'telecaller' as const },
];

type SeedUser = { id: string; role: string };

async function ensureUsers(): Promise<Record<string, SeedUser>> {
  const out: Record<string, SeedUser> = {};
  for (const u of USERS) {
    const created = await db.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role },
    });
    let id = created.data.user?.id;
    if (!id) {
      // Already exists — find it.
      const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
      id = data.users.find((x) => x.email === u.email)?.id;
    }
    if (!id) throw new Error(`Could not ensure user ${u.email}`);
    // Ensure profile + role (trigger sets it on create; enforce on re-run).
    await db.from('profiles').upsert({ id, full_name: u.full_name, role: u.role });
    out[u.email] = { id, role: u.role };
    console.log(`  user ${u.email} (${u.role}) -> ${id}`);
  }
  return out;
}

async function emptyVocBucket() {
  // Best-effort recursive delete of our {campaign}/{recipient}/{file} layout.
  const { data: campaigns } = await db.storage.from('voc').list('', { limit: 1000 });
  for (const c of campaigns ?? []) {
    if (!c.name) continue;
    const { data: recips } = await db.storage.from('voc').list(c.name, { limit: 1000 });
    const paths: string[] = [];
    for (const r of recips ?? []) {
      const { data: files } = await db.storage
        .from('voc')
        .list(`${c.name}/${r.name}`, { limit: 1000 });
      for (const f of files ?? []) paths.push(`${c.name}/${r.name}/${f.name}`);
    }
    if (paths.length) await db.storage.from('voc').remove(paths);
  }
}

async function wipeDemo() {
  console.log('Wiping prior demo data…');
  await emptyVocBucket();
  const { data: campaigns } = await db.from('campaigns').select('id');
  for (const c of campaigns ?? []) {
    // voc_recordings' FKs are intentionally non-cascading ("retained
    // indefinitely") — clear it first or the campaign delete is blocked.
    await db.from('voc_recordings').delete().eq('campaign_id', c.id);
    const { error } = await db.from('campaigns').delete().eq('id', c.id);
    if (error) console.warn(`  wipe: could not delete campaign ${c.id}: ${error.message}`);
  }
}

async function createCampaign(
  adminId: string,
  input: Partial<Campaign> & { calling_from: string },
): Promise<Campaign> {
  const { data, error } = await db
    .from('campaigns')
    .insert({
      calling_from: input.calling_from,
      order_reference: input.order_reference ?? null,
      start_date: input.start_date ?? '2026-07-01',
      end_date: input.end_date ?? '2026-08-31',
      default_language: input.default_language ?? 'hi',
      retry_limit: input.retry_limit ?? 2,
      skip_menu_if_known: input.skip_menu_if_known ?? false,
      language_config: input.language_config ?? [
        { dtmf: '1', lang: 'hi' },
        { dtmf: '2', lang: 'en' },
      ],
      created_by: adminId,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Campaign;
}

async function createTestRecipient(campaign: Campaign, adminId: string): Promise<Recipient> {
  const { data: batch } = await db
    .from('import_batches')
    .insert({
      campaign_id: campaign.id,
      file_name: 'test_recipient_import.xlsx',
      row_count: 1,
      valid_count: 1,
      error_count: 0,
      duplicate_count: 0,
      uploaded_by: adminId,
    })
    .select('id')
    .single();

  // TEST_PHONE is already a known-good E.164 literal — skip normalizePhone
  // here rather than call it from a plain tsx/Node script context, where
  // libphonenumber-js's metadata bundle doesn't resolve the same way it
  // does from the Next.js app (throws "Cannot read properties of undefined
  // (reading 'hasOwnProperty')" inside isSupportedCountry).
  const { data, error } = await db
    .from('recipients')
    .insert({
      campaign_id: campaign.id,
      unique_id: TEST_UNIQUE_ID,
      calling_from: campaign.calling_from,
      telecaller_name: 'Ravi Telecaller',
      contact_no: TEST_PHONE.replace('+91', ''),
      contact_no_e164: TEST_PHONE,
      customer_name: 'Test Recipient',
      address: '221B Baker Street, Kolkata, WB 700001',
      product_name: 'Prestige Induction Cooktop',
      product_delivery_date: null,
      status: 'imported',
      missing_address: false,
      missing_product: false,
      dedupe_key: `${campaign.id}:${TEST_PHONE}`,
      import_batch_id: batch?.id ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const recipient = data as Recipient;
  await logEvent(db, {
    recipientId: recipient.id,
    eventType: 'imported',
    actorType: 'admin',
    actorId: adminId,
    payload: { import_batch_id: batch?.id, campaign_id: campaign.id },
  });
  return recipient;
}

async function main() {
  console.log('Ensuring users…');
  const users = await ensureUsers();
  const adminId = users['admin@mjunction.test'].id;

  await wipeDemo();

  console.log('Creating test campaign + recipient…');
  const campaign = await createCampaign(adminId, {
    calling_from: 'Test Campaign',
    order_reference: 'ORD-TEST-2026',
    default_language: 'hi',
    language_config: [
      { dtmf: '1', lang: 'hi' },
      { dtmf: '2', lang: 'en' },
    ],
  });
  const recipient = await createTestRecipient(campaign, adminId);

  console.log('\n=== Seed complete ===');
  console.log(`Campaign: ${campaign.calling_from} (${campaign.id})`);
  console.log(`Recipient: ${recipient.customer_name}, ${recipient.contact_no_e164}, unique_id=${recipient.unique_id}, status=${recipient.status}`);
  console.log('\nLogin credentials:');
  console.log('  ADMIN      admin@mjunction.test / Admin@12345');
  console.log('  ADMIN      mjunction@appycodes.com / Admin@12345');
  console.log('  TELECALLER agent@mjunction.test / Agent@12345');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
