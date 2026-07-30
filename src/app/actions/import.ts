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
    .select('contact_no_e164')
    .eq('campaign_id', input.campaignId);
  const seen = new Set(
    (existing ?? []).map((r) => r.contact_no_e164).filter(Boolean) as string[],
  );

  // A supplied unique_id must be globally unique — collect any that already
  // exist so we skip them instead of failing the whole batch insert.
  const providedIds = input.rows.map((r) => r.unique_id).filter(Boolean) as string[];
  const { data: existingIds } = providedIds.length
    ? await supabase.from('recipients').select('unique_id').in('unique_id', providedIds)
    : { data: [] };
  const seenIds = new Set((existingIds ?? []).map((r) => r.unique_id));

  const toInsert: MappedRow[] = [];
  let skippedDuplicates = 0;
  for (const row of input.rows) {
    const dupPhone = !!row.contact_no_e164 && seen.has(row.contact_no_e164);
    const dupId = !!row.unique_id && seenIds.has(row.unique_id);
    if (dupPhone || dupId) {
      skippedDuplicates++;
      continue;
    }
    if (row.contact_no_e164) seen.add(row.contact_no_e164);
    if (row.unique_id) seenIds.add(row.unique_id);
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
      // Supplied id wins; omit to let the DB default generate a uuid.
      ...(r.unique_id ? { unique_id: r.unique_id } : {}),
      calling_from: r.calling_from ?? campaign.calling_from,
      telecaller_name: r.telecaller_name,
      contact_no: r.contact_no,
      contact_no_e164: r.contact_no_e164,
      customer_name: r.customer_name,
      address: r.address,
      product_name: r.product_name,
      product_delivery_date: r.product_delivery_date,
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
