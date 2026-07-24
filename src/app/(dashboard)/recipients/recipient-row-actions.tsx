'use client';

import { useState, useTransition } from 'react';
import { Truck, PackageCheck, PhoneOutgoing } from 'lucide-react';
import { saveDispatch, markDelivered } from '@/app/actions/dispatch';
import { runDeliveryConfirmation } from '@/app/actions/calls';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import type { RecipientStatus } from '@/lib/database.types';

const COURIERS = ['Delhivery', 'Blue Dart', 'DTDC', 'Ekart', 'XpressBees'];
const today = new Date().toISOString().slice(0, 10);

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

  const [modal, setModal] = useState<null | 'dispatch' | 'deliver'>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
    start(async () => {
      const res = await runDeliveryConfirmation(recipientId);
      if (res.error || !res.status) setError(res.error ?? 'Call failed');
      else onStatusChange(recipientId, res.status);
    });
  }

  if (!canDispatch && !canDeliver && !canConfirm) {
    return <span className="text-xs text-[var(--muted)]">—</span>;
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
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
          {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
        </div>
      )}

      <Modal open={modal === 'dispatch'} onClose={close} title="Dispatch item">
        <div className="space-y-4">
          <Field label="Delivery partner">
            <Select value={courier} onChange={(e) => setCourier(e.target.value)}>
              {COURIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
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
