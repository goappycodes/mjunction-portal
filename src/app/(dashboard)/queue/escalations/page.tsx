import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, Badge, Select } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { PageHeader } from '@/components/page-header';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface QueueItem {
  id: string;
  customer_name: string | null;
  contact: string | null;
  campaign: string | null;
  type: 'Order — address change' | 'Delivery — issue raised';
  updated_at: string;
}

export default async function EscalationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const typeFilter = sp.type ?? '';
  await requireUser();
  const supabase = await createClient();

  // Delivery issues.
  const { data: issues } = await supabase
    .from('recipients')
    .select('id, customer_name, contact_no_e164, updated_at, campaigns(calling_from)')
    .eq('status', 'issue_raised')
    .order('updated_at', { ascending: true });

  // Order escalations: press-2 transfers still awaiting agent (status pending).
  const { data: transfers } = await supabase
    .from('call_attempts')
    .select('recipient_id')
    .eq('call_type', 'order_confirmation')
    .eq('outcome', 'transferred_to_agent');
  const transferIds = Array.from(new Set((transfers ?? []).map((t) => t.recipient_id)));

  let orderEscalations: typeof issues = [];
  if (transferIds.length) {
    const { data } = await supabase
      .from('recipients')
      .select('id, customer_name, contact_no_e164, updated_at, campaigns(calling_from)')
      .in('id', transferIds)
      .eq('status', 'order_confirm_pending')
      .order('updated_at', { ascending: true });
    orderEscalations = data ?? [];
  }

  const cname = (c: unknown) => {
    const cc = Array.isArray(c) ? c[0] : c;
    return (cc as { calling_from?: string } | null)?.calling_from ?? null;
  };

  let items: QueueItem[] = [
    ...(orderEscalations ?? []).map((r) => ({
      id: r.id,
      customer_name: r.customer_name,
      contact: r.contact_no_e164,
      campaign: cname(r.campaigns),
      type: 'Order — address change' as const,
      updated_at: r.updated_at,
    })),
    ...(issues ?? []).map((r) => ({
      id: r.id,
      customer_name: r.customer_name,
      contact: r.contact_no_e164,
      campaign: cname(r.campaigns),
      type: 'Delivery — issue raised' as const,
      updated_at: r.updated_at,
    })),
  ];

  if (typeFilter === 'order') items = items.filter((i) => i.type.startsWith('Order'));
  else if (typeFilter === 'delivery') items = items.filter((i) => i.type.startsWith('Delivery'));
  items.sort((a, b) => a.updated_at.localeCompare(b.updated_at));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Escalations"
        description="Press-2 transfers awaiting an agent: order address changes (captured manually) and delivery issues."
      />

      <FilterBar action="/queue/escalations" resetHref="/queue/escalations">
        <FilterField label="Type">
          <Select name="type" defaultValue={typeFilter} className="w-56">
            <option value="">All escalations</option>
            <option value="order">Order — address change</option>
            <option value="delivery">Delivery — issue raised</option>
          </Select>
        </FilterField>
        <span className="self-center text-sm text-[var(--muted)]">{items.length} open</span>
      </FilterBar>

      {items.length ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--muted-surface)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Recipient</th>
                <th className="px-4 py-2.5 font-medium">Campaign</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Waiting since</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={`${it.type}-${it.id}`} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{it.customer_name ?? '—'}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">{it.contact}</p>
                  </td>
                  <td className="px-4 py-2.5">{it.campaign ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge color={it.type.startsWith('Order') ? 'amber' : 'red'}>{it.type}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--muted)]">
                    {formatDateTime(it.updated_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/recipients/${it.id}`}
                      className="font-medium text-[var(--primary)] hover:underline"
                    >
                      Handle →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-sm text-[var(--muted)]">No open escalations. 🎉</p>
        </Card>
      )}
    </div>
  );
}
