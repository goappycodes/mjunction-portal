import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, Input, Select } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { RetryButton } from './retry-button';
import { formatDateTime } from '@/lib/utils';
import type { RecipientStatus } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export default async function UnreachablePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string }>;
}) {
  const sp = await searchParams;
  await requireUser();
  const supabase = await createClient();

  const stageStatuses: RecipientStatus[] =
    sp.stage === 'order'
      ? ['order_unreachable']
      : sp.stage === 'delivery'
        ? ['delivery_unreachable']
        : ['order_unreachable', 'delivery_unreachable'];

  let query = supabase
    .from('recipients')
    .select('id, customer_name, contact_no_e164, status, updated_at, campaigns(calling_from)')
    .in('status', stageStatuses);
  if (sp.q) {
    query = query.or(`customer_name.ilike.%${sp.q}%,contact_no_e164.ilike.%${sp.q}%`);
  }
  const { data: rows } = await query.order('updated_at', { ascending: true });

  const cname = (c: unknown) => {
    const cc = Array.isArray(c) ? c[0] : c;
    return (cc as { calling_from?: string } | null)?.calling_from ?? '—';
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Unreachable"
        description="No-answer / not-reachable recipients awaiting a retry."
      />

      <FilterBar action="/queue/unreachable" resetHref="/queue/unreachable">
        <FilterField label="Search">
          <Input name="q" defaultValue={sp.q ?? ''} placeholder="Name or phone" className="w-56" />
        </FilterField>
        <FilterField label="Stage">
          <Select name="stage" defaultValue={sp.stage ?? ''} className="w-48">
            <option value="">Order &amp; delivery</option>
            <option value="order">Order unreachable</option>
            <option value="delivery">Delivery unreachable</option>
          </Select>
        </FilterField>
        <span className="self-center text-sm text-[var(--muted)]">{rows?.length ?? 0} pending</span>
      </FilterBar>

      {rows && rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--muted-surface)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Recipient</th>
                <th className="px-4 py-2.5 font-medium">Campaign</th>
                <th className="px-4 py-2.5 font-medium">Stage</th>
                <th className="px-4 py-2.5 font-medium">Since</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2.5">
                    <Link href={`/recipients/${r.id}`} className="font-medium hover:underline">
                      {r.customer_name ?? '—'}
                    </Link>
                    <p className="font-mono text-xs text-[var(--muted)]">{r.contact_no_e164}</p>
                  </td>
                  <td className="px-4 py-2.5">{cname(r.campaigns)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--muted)]">
                    {formatDateTime(r.updated_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <RetryButton recipientId={r.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-sm text-[var(--muted)]">No unreachable recipients. 🎉</p>
        </Card>
      )}
    </div>
  );
}
