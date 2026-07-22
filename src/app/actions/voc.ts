'use server';

import { requireUser } from '@/lib/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export interface SignedUrlResult {
  url?: string;
  error?: string;
}

/**
 * Generate a short-lived signed URL for a sealed VOC recording. The RLS check
 * happens first via the user-scoped client (must be able to read the row);
 * the signed URL is then minted with the service role (private bucket).
 */
export async function getSignedVocUrl(vocId: string): Promise<SignedUrlResult> {
  await requireUser();
  const supabase = await createClient();

  const { data: voc, error } = await supabase
    .from('voc_recordings')
    .select('storage_path')
    .eq('id', vocId)
    .single();
  if (error || !voc) return { error: 'Recording not found or access denied' };

  const service = createServiceClient();
  const { data, error: signErr } = await service.storage
    .from('voc')
    .createSignedUrl(voc.storage_path, 600); // 10 minutes
  if (signErr || !data) return { error: signErr?.message ?? 'Could not sign URL' };

  return { url: data.signedUrl };
}
