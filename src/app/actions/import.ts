'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/domain/audit';
import type { MappedRow } from '@/lib/domain/import';

export interface CommitResult {
  error?: string;
  inserted?: number;
  skippedDuplicates?: number;
  batchId?: string;
}

/**
 * Commit importable rows. Re-checks duplicates against the DB (authoritative),
 * writes an import_batches row, inserts recipients (status 'imported') and
 * appends an 'imported' timeline event per recipient.
 */
export async function commitImport(input: {
  fileName: string;
  rows: MappedRow[];
  counts: { rowCount: number; validCount: number; errorCount: number };
}): Promise<CommitResult> {
  const user = await requireAdmin();
  const supabase = await createClient();

  // Authoritative dedupe: unique_id is globally unique. Phone numbers are not
  // deduped — the same number can legitimately recur across orders/recipients.
  const { data: existing } = await supabase
    .from('recipients')
    .select('unique_id');
  const seenUniqueIds = new Set((existing ?? []).map((r) => r.unique_id).filter(Boolean));

  const toInsert: MappedRow[] = [];
  let skippedDuplicates = 0;
  for (const row of input.rows) {
    if (!row.unique_id || seenUniqueIds.has(row.unique_id)) {
      skippedDuplicates++;
      continue;
    }
    seenUniqueIds.add(row.unique_id);
    toInsert.push(row);
  }

  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .insert({
      file_name: input.fileName,
      row_count: input.counts.rowCount,
      valid_count: input.counts.validCount,
      error_count: input.counts.errorCount,
      duplicate_count: skippedDuplicates,
      uploaded_by: user.id,
    })
    .select('id')
    .single();
  if (batchErr || !batch) return { error: batchErr?.message ?? 'Could not create import batch' };

  if (toInsert.length) {
    const rows = toInsert.map((r) => ({
      unique_id: r.unique_id as string,
      order_id: r.order_id,
      vendor_po_number: r.vendor_po_number,
      vendor_dispatch_id: r.vendor_dispatch_id,
      order_date: r.order_date,
      ordered_quantity: r.ordered_quantity,
      dispatch_quantity: r.dispatch_quantity,
      courier_name: r.courier_name,
      telecaller_name: null,
      telecaller_phone: null,
      contact_no: r.contact_no,
      contact_no_e164: r.contact_no_e164,
      email: r.email,
      customer_name: r.customer_name,
      address: r.address,
      product_name: r.product_name,
      product_delivery_date: null,
      status: 'imported' as const,
      missing_address: !r.address,
      missing_product: !r.product_name,
      dedupe_key: r.contact_no_e164 ?? null,
      import_batch_id: batch.id,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from('recipients')
      .insert(rows)
      .select('id');
    if (insErr) return { error: insErr.message };

    for (const r of inserted ?? []) {
      await logEvent(supabase, {
        recipientId: r.id,
        eventType: 'imported',
        actorType: 'admin',
        actorId: user.id,
        payload: { import_batch_id: batch.id, file_name: input.fileName },
      });
    }
  }

  revalidatePath('/recipients');
  return {
    inserted: toInsert.length,
    skippedDuplicates,
    batchId: batch.id,
  };
}

export interface UpdateResult {
  error?: string;
  updated?: number;
  notFound?: number;
}

/**
 * Update recipients' company_name by unique_id (Order Item ID).
 * Rows whose unique_id does not exist are counted as notFound, not an error.
 */
export async function updateRecipients(input: {
  rows: { unique_id: string; company_name: string }[];
}): Promise<UpdateResult> {
  await requireAdmin();
  const supabase = await createClient();

  let updated = 0;
  let notFound = 0;

  for (const row of input.rows) {
    const { data, error } = await supabase
      .from('recipients')
      .update({ company_name: row.company_name })
      .eq('unique_id', row.unique_id)
      .select('id');

    if (error) return { error: error.message };
    if (!data || data.length === 0) notFound++;
    else updated += data.length;
  }

  revalidatePath('/recipients');
  return { updated, notFound };
}
