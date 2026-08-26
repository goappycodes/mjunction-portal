import { createClient } from '@/lib/supabase/server';
import { getLanguages, langName } from '@/lib/domain/languages';
import { RecipientsTable, type RecipientRow } from './recipients-table';
import { Pagination } from '@/components/ui/pagination';
import { TableFilters } from '@/components/ui/table-filters';
import { STATUS_LABELS } from '@/lib/domain/labels';
import { buildQuery } from '@/lib/utils';
import type { RecipientStatus } from '@/lib/database.types';

const PAGE_SIZE = 15;
const BASE = '/recipients';
const NO_MATCH = '00000000-0000-0000-0000-000000000000';

/**
 * Merged Recipients + Calls view. The recipient list is the spine; each row is
 * enriched with an aggregate of that recipient's call attempts (count + most
 * recent attempt's timestamp).
 */
export async function RecipientCallsView({
  isAdmin,
  sp,
}: {
  isAdmin: boolean;
  sp: { status?: string; q?: string; telecaller?: string; page?: string };
}) {
  const supabase = await createClient();

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from('recipients').select('*', { count: 'exact' });
  if (sp.status && sp.status in STATUS_LABELS) {
    query = query.eq('status', sp.status as RecipientStatus);
  }
  if (sp.telecaller) query = query.eq('telecaller_name', sp.telecaller);
  if (sp.q) {
    query = query.or(
      `customer_name.ilike.%${sp.q}%,contact_no.ilike.%${sp.q}%,contact_no_e164.ilike.%${sp.q}%,product_name.ilike.%${sp.q}%`,
    );
  }

  let telecallerQuery = supabase
    .from('recipients')
    .select('telecaller_name')
    .not('telecaller_name', 'is', null);

  const [{ data: recipients, count }, allLanguages, { data: telecallerRows }] = await Promise.all([
    query.order('updated_at', { ascending: false }).range(from, to),
    getLanguages(supabase),
    telecallerQuery,
  ]);

  const telecallers = Array.from(
    new Set((telecallerRows ?? []).map((r) => r.telecaller_name).filter((v): v is string => !!v)),
  ).sort();

  const langMap: Record<string, string> = {};
  for (const l of allLanguages) langMap[l.code] = l.display_name;

  const recipientIds = (recipients ?? []).map((r) => r.id);

  const { data: calls } = await supabase
    .from('call_attempts')
    .select('recipient_id, created_at')
    .in('recipient_id', recipientIds.length ? recipientIds : [NO_MATCH])
    .order('created_at', { ascending: false });

  type CallAgg = { attempts: number; last: NonNullable<typeof calls>[number] };
  const callAgg = new Map<string, CallAgg>();
  for (const c of calls ?? []) {
    const cur = callAgg.get(c.recipient_id);
    if (cur) cur.attempts += 1;
    else callAgg.set(c.recipient_id, { attempts: 1, last: c });
  }

  const rows: RecipientRow[] = (recipients ?? []).map((r) => {
    const agg = callAgg.get(r.id);
    return {
      ...r,
      language_name: langName(langMap, r.preferred_language),
      attempts: agg?.attempts ?? 0,
      last_call_at: agg?.last.created_at ?? null,
    };
  });

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <TableFilters
        key={[sp.status ?? '', sp.telecaller ?? ''].join('|')}
        basePath={BASE}
        searchPlaceholder="Name, phone or product"
        searchableSelects={[
          {
            name: 'status',
            label: 'Status',
            placeholder: 'All statuses…',
            searchPlaceholder: 'Search statuses…',
            allLabel: 'All statuses',
            width: 'w-48',
            options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
          },
          {
            name: 'telecaller',
            label: 'Telecaller',
            placeholder: 'Any telecaller…',
            searchPlaceholder: 'Search telecallers…',
            allLabel: 'All telecallers',
            width: 'w-48',
            options: telecallers.map((t) => ({ value: t, label: t })),
          },
        ]}
      />

      <RecipientsTable rows={rows} isAdmin={isAdmin} />

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) =>
          buildQuery(BASE, {
            status: sp.status,
            q: sp.q,
            telecaller: sp.telecaller,
            page: p,
          })
        }
      />
    </div>
  );
}
