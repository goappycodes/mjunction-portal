import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getLanguageMap, getLanguages, langName } from '@/lib/domain/languages';
import { Card, Badge, Input, Select } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { VocPlayer } from '@/components/voc-player';
import { formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 15;
const BASE = '/voc';

export async function VocView({
  campaignId,
  sp,
}: {
  campaignId: string;
  sp: { q?: string; lang?: string; page?: string };
}) {
  const supabase = await createClient();

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let vocQuery = supabase
    .from('voc_recordings')
    .select('*, recipients(customer_name, contact_no_e164)', { count: 'exact' })
    .eq('campaign_id', campaignId);
  if (sp.lang) vocQuery = vocQuery.eq('language', sp.lang);
  if (sp.q) vocQuery = vocQuery.or(`sealed_voc_id.ilike.%${sp.q}%,product_name.ilike.%${sp.q}%`);

  const [{ data: vocs, count }, langMap, languages] = await Promise.all([
    vocQuery.order('created_at', { ascending: false }).range(from, to),
    getLanguageMap(supabase),
    getLanguages(supabase, true),
  ]);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qsFor = (p: number) => {
    const u = new URLSearchParams();
    u.set('campaign', campaignId);
    u.set('view', 'voc');
    if (sp.q) u.set('q', sp.q);
    if (sp.lang) u.set('lang', sp.lang);
    u.set('page', String(p));
    return `${BASE}?${u.toString()}`;
  };
  const resetHref = `${BASE}?campaign=${campaignId}&view=voc`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Sealed VOC recordings in the private vault — retained indefinitely, played via
        short-lived signed URLs. {total} recording(s).
      </p>

      <FilterBar action={BASE} resetHref={resetHref}>
        <input type="hidden" name="campaign" value={campaignId} />
        <input type="hidden" name="view" value="voc" />
        <FilterField label="Search">
          <Input name="q" defaultValue={sp.q ?? ''} placeholder="Sealed VOC id or product" className="w-64" />
        </FilterField>
        <FilterField label="Language">
          <Select name="lang" defaultValue={sp.lang ?? ''} className="w-40">
            <option value="">All languages</option>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.display_name}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {vocs && vocs.length ? (
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--muted-surface)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Sealed VOC id</th>
                <th className="px-4 py-2.5 font-medium">Recipient</th>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Language</th>
                <th className="px-4 py-2.5 font-medium">DTMF</th>
                <th className="px-4 py-2.5 font-medium">Duration</th>
                <th className="px-4 py-2.5 font-medium">Sealed</th>
                <th className="px-4 py-2.5 font-medium">Recording</th>
              </tr>
            </thead>
            <tbody>
              {vocs.map((v) => {
                const rec = Array.isArray(v.recipients) ? v.recipients[0] : v.recipients;
                return (
                  <tr key={v.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Badge color="green">{v.sealed_voc_id}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{rec?.customer_name ?? '—'}</p>
                      <p className="font-mono text-xs text-[var(--muted)]">
                        {rec?.contact_no_e164 ?? ''}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">{v.product_name ?? '—'}</td>
                    <td className="px-4 py-2.5">{langName(langMap, v.language)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{v.dtmf_outcome ?? '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums">{v.duration_seconds ?? 0}s</td>
                    <td className="px-4 py-2.5 text-xs text-[var(--muted)]">
                      {formatDateTime(v.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <VocPlayer vocId={v.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-sm text-[var(--muted)]">
            No sealed VOCs yet. Confirmed delivery-confirmation calls seal a VOC here.
          </p>
        </Card>
      )}

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
