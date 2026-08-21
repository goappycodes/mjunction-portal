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
 * Commit importable rows into a campaign. Re-checks duplicates against the DB
 * (authoritative), writes an import_batches row, inserts recipients (status
 * 'imported') and appends an 'imported' timeline event per recipient.
 */
export async function commitImport(input: {
  campaignId: string;
  fileName: string;
  rows: MappedRow[];
  counts: { rowCount: number; validCount: number; errorCount: number; duplicateCount: number };
}): Promise<CommitResult> {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, calling_from')
    .eq('id', input.campaignId)
    .single();
  if (!campaign) return { error: 'Campaign not found' };

  // Authoritative dedupe against existing recipients in this campaign.
  const { data: existing } = await supabase
    .from('recipients')
    .select('contact_no_e164, unique_id')
    .eq('campaign_id', input.campaignId);
  const seen = new Set(
    (existing ?? []).map((r) => r.contact_no_e164).filter(Boolean) as string[],
  );
  const seenUniqueIds = new Set((existing ?? []).map((r) => r.unique_id).filter(Boolean));

  const toInsert: MappedRow[] = [];
  let skippedDuplicates = 0;
  for (const row of input.rows) {
    if (!row.unique_id || seenUniqueIds.has(row.unique_id)) {
      skippedDuplicates++;
      continue;
    }
    if (row.contact_no_e164 && seen.has(row.contact_no_e164)) {
      skippedDuplicates++;
      continue;
    }
    seenUniqueIds.add(row.unique_id);
    if (row.contact_no_e164) seen.add(row.contact_no_e164);
    toInsert.push(row);
  }

  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .insert({
      campaign_id: input.campaignId,
      file_name: input.fileName,
      row_count: input.counts.rowCount,
      valid_count: input.counts.validCount,
      error_count: input.counts.errorCount,
      duplicate_count: input.counts.duplicateCount + skippedDuplicates,
      uploaded_by: user.id,
    })
    .select('id')
    .single();
  if (batchErr || !batch) return { error: batchErr?.message ?? 'Could not create import batch' };

  if (toInsert.length) {
    const rows = toInsert.map((r) => ({
      campaign_id: input.campaignId,
      unique_id: r.unique_id as string,
      order_id: r.order_id,
      vendor_po_number: r.vendor_po_number,
      vendor_dispatch_id: r.vendor_dispatch_id,
      order_date: r.order_date,
      ordered_quantity: r.ordered_quantity,
      dispatch_quantity: r.dispatch_quantity,
      courier_name: r.courier_name,
      calling_from: campaign.calling_from,
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
      dedupe_key: r.contact_no_e164 ? `${input.campaignId}:${r.contact_no_e164}` : null,
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

  revalidatePath(`/campaigns/${input.campaignId}`, 'layout');
  revalidatePath('/recipients');
  return {
    inserted: toInsert.length,
    skippedDuplicates,
    batchId: batch.id,
  };
}
