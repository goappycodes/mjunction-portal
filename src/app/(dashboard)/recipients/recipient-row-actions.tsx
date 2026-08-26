'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, PackageCheck, PhoneOutgoing } from 'lucide-react';
import { saveDispatch, markDelivered } from '@/app/actions/dispatch';
import { runDeliveryConfirmation, retryCall, startOrderConfirmationCall } from '@/app/actions/calls';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/primitives';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Modal } from '@/components/ui/modal';
import type { RecipientStatus } from '@/lib/database.types';

const COURIERS = ['Delhivery', 'Blue Dart', 'DTDC', 'Ekart', 'XpressBees'];
const today = new Date().toISOString().slice(0, 10);

/**
 * Shown after a real IVR call is handed to the engine. The outcome lands on
 * the recipient minutes later, via the engine's own writes — so this is the
 * only acknowledgement the row can honestly give at this point.
 */
function CallPlacedNote() {
  return (
    <span className="text-xs text-[var(--muted)]">
      Call placed — status updates when the call completes.
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/**
 * Inline dispatch / delivery actions for a recipient row. The Dispatch button
 * shows only once the address is confirmed; after dispatch it becomes
 * "Mark as delivered". Each opens a modal form. On success it calls back so the
 * parent can patch just this row's status — no page reload.
 */
export function RecipientRowActions({
  recipientId,
  status,
  onStatusChange,
}: {
  recipientId: string;
  status: RecipientStatus;
  onStatusChange: (id: string, status: RecipientStatus) => void;
}) {
  const canDispatch = status === 'address_confirmed' || status === 'address_corrected';
  const canDeliver = status === 'dispatched';
  const canConfirm = status === 'delivery_confirm_pending' || status === 'delivery_unreachable';
  const canCallNow = status === 'imported' || status === 'order_confirm_pending';
  // delivery_unreachable already gets a call button via canConfirm above —
  // this is the order-confirmation half's equivalent, which had no action at
  // all on this table (only the recipient detail page's "Retry call" did).
  const canCallBack = status === 'order_unreachable';

  const router = useRouter();
  const [modal, setModal] = useState<null | 'dispatch' | 'deliver'>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // A real (Exotel) call resolves over minutes, not in this request — the row
  // keeps its current status until the caller works through the menu. Without
  // this the button would just stop spinning and nothing would visibly change.
  const [placed, setPlaced] = useState(false);

  const [courier, setCourier] = useState(COURIERS[0]);
  const [awb, setAwb] = useState('');
  const [dispatchDate, setDispatchDate] = useState(today);
  const [deliverDate, setDeliverDate] = useState(today);

  const close = () => {
    setModal(null);
    setError(null);
  };

  function submitDispatch() {
    setError(null);
    start(async () => {
      const res = await saveDispatch({
        recipientId,
        courier_name: courier,
        awb_number: awb.trim(),
        dispatch_date: dispatchDate,
      });
      if (res.error) setError(res.error);
      else {
        onStatusChange(recipientId, 'dispatched');
        close();
      }
    });
  }

  function submitDeliver() {
    setError(null);
    start(async () => {
      const res = await markDelivered({ recipientId, delivered_date: deliverDate });
      if (res.error) setError(res.error);
      else {
        onStatusChange(recipientId, 'delivery_confirm_pending');
        close();
      }
    });
  }

  function runConfirmation() {
    setError(null);
    setPlaced(false);
    start(async () => {
      const res = await runDeliveryConfirmation(recipientId);
      if (res.error || !res.status) setError(res.error ?? 'Call failed');
      else if (res.placed) setPlaced(true);
      else onStatusChange(recipientId, res.status);
    });
  }

  function callNow() {
    setError(null);
    setPlaced(false);
    start(async () => {
      const res = await startOrderConfirmationCall(recipientId);
      if (res.error) setError(res.error);
      else {
        setPlaced(true);
        if (status === 'imported') onStatusChange(recipientId, 'order_confirm_pending');
      }
    });
  }

  function callBack() {
    setError(null);
    setPlaced(false);
    start(async () => {
      const res = await retryCall(recipientId);
      if (res.error) setError(res.error);
      else {
        setPlaced(true);
        // retryCall doesn't report the recipient's new status directly (a
        // real call resolves it minutes later via the IVR engine's own
        // writes) — refresh so a mock call's synchronous result still shows.
        router.refresh();
      }
    });
  }

  if (!canDispatch && !canDeliver && !canConfirm && !canCallNow && !canCallBack) {
    return <span className="text-xs text-[var(--muted)]">—</span>;
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {canCallNow && (
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="secondary" onClick={callNow} loading={pending}>
            <PhoneOutgoing className="h-4 w-4" /> Call Now
          </Button>
          {placed && <CallPlacedNote />}
          {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
        </div>
      )}
      {canCallBack && (
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="secondary" onClick={callBack} loading={pending}>
            <PhoneOutgoing className="h-4 w-4" /> Call back
          </Button>
          {placed && <CallPlacedNote />}
          {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
        </div>
      )}
      {canDispatch && (
        <Button size="sm" variant="primary" onClick={() => setModal('dispatch')}>
          <Truck className="h-4 w-4" /> Dispatch
        </Button>
      )}
      {canDeliver && (
        <Button size="sm" variant="success" onClick={() => setModal('deliver')}>
          <PackageCheck className="h-4 w-4" /> Mark as delivered
        </Button>
      )}
      {canConfirm && (
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="secondary" onClick={runConfirmation} loading={pending}>
            <PhoneOutgoing className="h-4 w-4" /> Run confirmation call
          </Button>
          {placed && <CallPlacedNote />}
          {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
        </div>
      )}

      <Modal open={modal === 'dispatch'} onClose={close} title="Dispatch item">
        <div className="space-y-4">
          <Field label="Delivery partner">
            <SearchableSelect
              value={courier}
              onChange={setCourier}
              options={COURIERS.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="AWB number">
            <Input
              value={awb}
              onChange={(e) => setAwb(e.target.value)}
              placeholder="e.g. 1234567890"
              autoFocus
            />
          </Field>
          <Field label="Dispatch date">
            <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitDispatch} loading={pending} disabled={!awb.trim()}>
              Dispatch
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'deliver'} onClose={close} title="Mark as delivered">
        <div className="space-y-4">
          <Field label="Delivery date">
            <Input
              type="date"
              value={deliverDate}
              onChange={(e) => setDeliverDate(e.target.value)}
              autoFocus
            />
          </Field>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="success" size="sm" onClick={submitDeliver} loading={pending}>
              Mark as delivered
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
