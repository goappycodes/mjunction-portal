import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getLanguageMap, getLanguages, langName } from '@/lib/domain/languages';
import { RecipientsTable, type RecipientRow } from './recipients-table';
import { Input, Select } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { STATUS_LABELS } from '@/lib/domain/labels';
import type { RecipientStatus } from '@/lib/database.types';

const PAGE_SIZE = 15;
const BASE = '/recipients';

export async function RecipientsView({
  campaignId,
  sp,
}: {
  campaignId: string;
  sp: { status?: string; q?: string; lang?: string; page?: string };
}) {
  const supabase = await createClient();

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('recipients')
    .select('*', { count: 'exact' })
    .eq('campaign_id', campaignId);

  if (sp.status && sp.status in STATUS_LABELS) {
    query = query.eq('status', sp.status as RecipientStatus);
  }
  if (sp.lang) {
    query = sp.lang === 'unset' ? query.is('preferred_language', null) : query.eq('preferred_language', sp.lang);
  }
  if (sp.q) {
    query = query.or(
      `customer_name.ilike.%${sp.q}%,contact_no.ilike.%${sp.q}%,contact_no_e164.ilike.%${sp.q}%,product_name.ilike.%${sp.q}%`,
    );
  }

  const [{ data, count }, langMap, languages] = await Promise.all([
    query.order('updated_at', { ascending: false }).range(from, to),
    getLanguageMap(supabase),
    getLanguages(supabase, true),
  ]);

  const rows: RecipientRow[] = (data ?? []).map((r) => ({
    ...r,
    language_name: langName(langMap, r.preferred_language),
  }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qsFor = (p: number) => {
    const u = new URLSearchParams();
    u.set('campaign', campaignId);
    u.set('view', 'recipients');
    if (sp.status) u.set('status', sp.status);
    if (sp.q) u.set('q', sp.q);
    if (sp.lang) u.set('lang', sp.lang);
    u.set('page', String(p));
    return `${BASE}?${u.toString()}`;
  };
  const resetHref = `${BASE}?campaign=${campaignId}&view=recipients`;

  return (
    <div className="space-y-4">
      <FilterBar action={BASE} resetHref={resetHref}>
        <input type="hidden" name="campaign" value={campaignId} />
        <input type="hidden" name="view" value="recipients" />
        <FilterField label="Search">
          <Input name="q" defaultValue={sp.q ?? ''} placeholder="Name, phone or product" className="w-56" />
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={sp.status ?? ''} className="w-48">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Language">
          <Select name="lang" defaultValue={sp.lang ?? ''} className="w-40">
            <option value="">All languages</option>
            <option value="unset">Not captured</option>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.display_name}
              </option>
            ))}
          </Select>
        </FilterField>
        <span className="self-center text-sm text-[var(--muted)]">
          {total} recipient{total === 1 ? '' : 's'}
        </span>
      </FilterBar>

      <RecipientsTable rows={rows} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={qsFor(page - 1)} className="rounded-lg border px-3 py-1.5 hover:bg-[var(--muted-surface)]">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={qsFor(page + 1)} className="rounded-lg border px-3 py-1.5 hover:bg-[var(--muted-surface)]">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
