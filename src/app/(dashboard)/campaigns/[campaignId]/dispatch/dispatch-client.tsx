'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveDispatch, markDelivered } from '@/app/actions/dispatch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui/primitives';

export interface PendingRow {
  id: string;
  customer_name: string | null;
  product_name: string | null;
  address: string | null;
}
export interface AwaitingRow {
  id: string;
  customer_name: string | null;
  product_name: string | null;
  courier_name: string | null;
  awb_number: string | null;
  dispatch_date: string | null;
}

const COURIERS = ['Delhivery', 'Blue Dart', 'DTDC', 'Ekart', 'XpressBees'];
const today = new Date().toISOString().slice(0, 10);

function DispatchRow({ row }: { row: PendingRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [courier, setCourier] = useState(COURIERS[0]);
  const [awb, setAwb] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      const res = await saveDispatch({
        recipientId: row.id,
        courier_name: courier,
        awb_number: awb,
        dispatch_date: date,
      });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <td className="py-2 pr-3">
        <p className="font-medium">{row.customer_name ?? '—'}</p>
        <p className="text-xs text-[var(--muted)]">{row.product_name ?? '—'}</p>
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </td>
      <td className="py-2 pr-3">
        <select
          value={courier}
          onChange={(e) => setCourier(e.target.value)}
          className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
        >
          {COURIERS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <Input value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="AWB" className="h-8 w-32" />
      </td>
      <td className="py-2 pr-3">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-36" />
      </td>
      <td className="py-2">
        <Button size="sm" onClick={submit} disabled={pending || !awb}>
          {pending ? '…' : 'Dispatch'}
        </Button>
      </td>
    </tr>
  );
}

function DeliverRow({ row }: { row: AwaitingRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      const res = await markDelivered({ recipientId: row.id, delivered_date: date });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <td className="py-2 pr-3">
        <p className="font-medium">{row.customer_name ?? '—'}</p>
        <p className="text-xs text-[var(--muted)]">{row.product_name ?? '—'}</p>
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </td>
      <td className="py-2 pr-3 text-sm">
        {row.courier_name} · <span className="font-mono text-xs">{row.awb_number}</span>
      </td>
      <td className="py-2 pr-3">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-36" />
      </td>
      <td className="py-2">
        <Button size="sm" variant="success" onClick={submit} disabled={pending}>
          {pending ? '…' : 'Mark delivered'}
        </Button>
      </td>
    </tr>
  );
}

export function DispatchClient({
  pending,
  awaiting,
}: {
  pending: PendingRow[];
  awaiting: AwaitingRow[];
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ready to dispatch ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {pending.map((r) => (
                    <DispatchRow key={r.id} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              No recipients with a confirmed address awaiting dispatch.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Awaiting delivery ({awaiting.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {awaiting.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {awaiting.map((r) => (
                    <DeliverRow key={r.id} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              Nothing in transit. Marking delivered auto-enqueues the delivery-confirmation call.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
