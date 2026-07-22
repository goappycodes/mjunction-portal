import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Language } from '@/lib/database.types';

type DB = SupabaseClient<Database>;

export async function getLanguages(db: DB, activeOnly = false): Promise<Language[]> {
  let q = db.from('languages').select('*').order('display_name');
  if (activeOnly) q = q.eq('is_active', true);
  const { data } = await q;
  return data ?? [];
}

export async function getLanguageMap(db: DB): Promise<Record<string, string>> {
  const langs = await getLanguages(db);
  const map: Record<string, string> = {};
  for (const l of langs) map[l.code] = l.display_name;
  return map;
}

export function langName(map: Record<string, string>, code: string | null): string {
  if (!code) return '—';
  return map[code] ?? code;
}
