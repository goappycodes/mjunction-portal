import { createClient } from '@/lib/supabase/server';
import { DispatchClient, type AwaitingRow, type PendingRow } from './dispatch-client';
import { Input } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';

const BASE = '/recipients';

export async function DispatchView({
  campaignId,
  sp,
}: {
  campaignId: string;
  sp: { q?: string };
}) {
  const supabase = await createClient();

  let pendingQuery = supabase
    .from('recipients')
    .select('id, customer_name, product_name, address')
    .eq('campaign_id', campaignId)
    .in('status', ['address_confirmed', 'address_corrected']);
  if (sp.q) pendingQuery = pendingQuery.ilike('customer_name', `%${sp.q}%`);
  const { data: pendingRows } = await pendingQuery.order('updated_at', { ascending: true });

  let dispatchedQuery = supabase
    .from('recipients')
    .select('id, customer_name, product_name, dispatches(courier_name, awb_number, dispatch_date)')
    .eq('campaign_id', campaignId)
    .eq('status', 'dispatched');
  if (sp.q) dispatchedQuery = dispatchedQuery.ilike('customer_name', `%${sp.q}%`);
  const { data: dispatchedRows } = await dispatchedQuery.order('updated_at', { ascending: true });

  const resetHref = `${BASE}?campaign=${campaignId}&view=dispatch`;

  const awaiting: AwaitingRow[] = (dispatchedRows ?? []).map((r) => {
    const d = Array.isArray(r.dispatches) ? r.dispatches[0] : r.dispatches;
    return {
      id: r.id,
      customer_name: r.customer_name,
      product_name: r.product_name,
      courier_name: d?.courier_name ?? null,
      awb_number: d?.awb_number ?? null,
      dispatch_date: d?.dispatch_date ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <FilterBar action={BASE} resetHref={resetHref}>
        <input type="hidden" name="campaign" value={campaignId} />
        <input type="hidden" name="view" value="dispatch" />
        <FilterField label="Search">
          <Input name="q" defaultValue={sp.q ?? ''} placeholder="Customer name" className="w-64" />
        </FilterField>
      </FilterBar>
      <DispatchClient
        pending={(pendingRows ?? []) as PendingRow[]}
        awaiting={awaiting}
      />
    </div>
  );
}
