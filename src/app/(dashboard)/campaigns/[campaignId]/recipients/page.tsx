import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLanguageMap, langName } from '@/lib/domain/languages';
import { RecipientsTable, type RecipientRow } from './recipients-table';
import { Input, Select } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { STATUS_LABELS } from '@/lib/domain/labels';
import type { RecipientStatus } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default async function RecipientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { campaignId } = await params;
  const sp = await searchParams;
  await requireUser();
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
  if (sp.q) {
    query = query.or(
      `customer_name.ilike.%${sp.q}%,contact_no.ilike.%${sp.q}%,contact_no_e164.ilike.%${sp.q}%`,
    );
  }

  const [{ data, count }, langMap] = await Promise.all([
    query.order('updated_at', { ascending: false }).range(from, to),
    getLanguageMap(supabase),
  ]);

  const rows: RecipientRow[] = (data ?? []).map((r) => ({
    ...r,
    language_name: langName(langMap, r.preferred_language),
  }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/campaigns/${campaignId}/recipients`;
  const qsFor = (p: number) => {
    const u = new URLSearchParams();
    if (sp.status) u.set('status', sp.status);
    if (sp.q) u.set('q', sp.q);
    u.set('page', String(p));
    return `${base}?${u.toString()}`;
  };

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" action={base}>
        <div className="space-y-1">
          <label className="text-xs text-[var(--muted)]">Search</label>
          <Input name="q" defaultValue={sp.q ?? ''} placeholder="Name or phone" className="w-56" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[var(--muted)]">Status</label>
          <Select name="status" defaultValue={sp.status ?? ''} className="w-52">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        <span className="ml-auto self-center text-sm text-[var(--muted)]">
          {total} recipient{total === 1 ? '' : 's'}
        </span>
      </form>

      <RecipientsTable rows={rows} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={qsFor(page - 1)} className="rounded-md border px-3 py-1.5 hover:bg-[var(--muted-surface)]">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={qsFor(page + 1)} className="rounded-md border px-3 py-1.5 hover:bg-[var(--muted-surface)]">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
