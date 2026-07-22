import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Campaign } from '@/lib/database.types';

/**
 * Cached single-campaign fetch. React cache() dedupes by argument within one
 * request, so the campaign layout and any page under it that needs the campaign
 * (reports, language config) share a single Supabase round-trip.
 */
export const getCampaign = cache(async (id: string): Promise<Campaign | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from('campaigns').select('*').eq('id', id).single();
  return data ?? null;
});
