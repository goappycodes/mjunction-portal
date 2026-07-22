import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DispatchClient, type AwaitingRow, type PendingRow } from './dispatch-client';

export const dynamic = 'force-dynamic';

export default async function DispatchPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  await requireAdmin();
  const supabase = await createClient();

  const { data: pendingRows } = await supabase
    .from('recipients')
    .select('id, customer_name, product_name, address')
    .eq('campaign_id', campaignId)
    .in('status', ['address_confirmed', 'address_corrected'])
    .order('updated_at', { ascending: true });

  const { data: dispatchedRows } = await supabase
    .from('recipients')
    .select('id, customer_name, product_name, dispatches(courier_name, awb_number, dispatch_date)')
    .eq('campaign_id', campaignId)
    .eq('status', 'dispatched')
    .order('updated_at', { ascending: true });

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
    <DispatchClient
      pending={(pendingRows ?? []) as PendingRow[]}
      awaiting={awaiting}
    />
  );
}
