/**
 * Minimal test seed.
 *   npm run seed
 *
 * Creates the admin/telecaller login users and one recipient
 * (+917872944208, unique_id ORD-TEST-0001, status `imported`) —
 * fresh and ready to test the "Call Now" order-confirmation flow against a
 * real number. Idempotent: wipes prior demo recipients first.
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

import type { Database, Recipient } from '../../src/lib/database.types';
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
      const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
      id = data.users.find((x) => x.email === u.email)?.id;
    }
    if (!id) throw new Error(`Could not ensure user ${u.email}`);
    await db.from('profiles').upsert({ id, full_name: u.full_name, role: u.role });
    out[u.email] = { id, role: u.role };
    console.log(`  user ${u.email} (${u.role}) -> ${id}`);
  }
  return out;
}

async function emptyVocBucket() {
  const { data: folders } = await db.storage.from('voc').list('', { limit: 1000 });
  for (const folder of folders ?? []) {
    if (!folder.name) continue;
    const { data: files } = await db.storage.from('voc').list(folder.name, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${folder.name}/${f.name}`);
    if (paths.length) await db.storage.from('voc').remove(paths);
  }
}

async function wipeDemo() {
  console.log('Wiping prior demo data…');
  await emptyVocBucket();
  await db.from('recipients').delete().eq('unique_id', TEST_UNIQUE_ID);
}

async function createTestRecipient(adminId: string): Promise<Recipient> {
  const { data: batch } = await db
    .from('import_batches')
    .insert({
      file_name: 'test_recipient_import.xlsx',
      row_count: 1,
      valid_count: 1,
      error_count: 0,
      duplicate_count: 0,
      uploaded_by: adminId,
    })
    .select('id')
    .single();

  const { data, error } = await db
    .from('recipients')
    .insert({
      unique_id: TEST_UNIQUE_ID,
      company_name: 'Test Company',
      telecaller_name: 'Ravi Telecaller',
      telecaller_phone: TEST_PHONE,
      contact_no: TEST_PHONE.replace('+91', ''),
      contact_no_e164: TEST_PHONE,
      customer_name: 'Test Recipient',
      address: '221B Baker Street, Kolkata, WB 700001',
      product_name: 'Prestige Induction Cooktop',
      product_delivery_date: null,
      status: 'imported',
      missing_address: false,
      missing_product: false,
      dedupe_key: TEST_PHONE,
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
    payload: { import_batch_id: batch?.id },
  });
  return recipient;
}

async function main() {
  console.log('Ensuring users…');
  const users = await ensureUsers();
  const adminId = users['admin@mjunction.test'].id;

  await wipeDemo();

  console.log('Creating test recipient…');
  const recipient = await createTestRecipient(adminId);

  console.log('\n=== Seed complete ===');
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
