'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { updateRecipient } from '@/app/actions/recipients';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input, Label, Textarea } from '@/components/ui/primitives';
import type { Recipient } from '@/lib/database.types';

/** Admin-only "Edit" popup for correcting a recipient's own details (not its pipeline status). */
export function RecipientEditButton({ recipient }: { recipient: Recipient }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState(recipient.customer_name ?? '');
  const [contactNo, setContactNo] = useState(recipient.contact_no ?? '');
  const [email, setEmail] = useState(recipient.email ?? '');
  const [address, setAddress] = useState(recipient.address ?? '');
  const [productName, setProductName] = useState(recipient.product_name ?? '');
  const [productDeliveryDate, setProductDeliveryDate] = useState(
    recipient.product_delivery_date ?? '',
  );
  const [telecallerName, setTelecallerName] = useState(recipient.telecaller_name ?? '');
  const [telecallerPhone, setTelecallerPhone] = useState(recipient.telecaller_phone ?? '');

  function submit() {
    setError(null);
    start(async () => {
      const res = await updateRecipient({
        recipientId: recipient.id,
        customerName,
        contactNo,
        email,
        address,
        productName,
        productDeliveryDate: productDeliveryDate || null,
        telecallerName,
        telecallerPhone,
      });
      if (res.error) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit order">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer name</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact number</Label>
              <Input value={contactNo} onChange={(e) => setContactNo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Product name</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery date</Label>
              <Input
                type="date"
                value={productDeliveryDate ?? ''}
                onChange={(e) => setProductDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telecaller name</Label>
              <Input value={telecallerName} onChange={(e) => setTelecallerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telecaller contact no</Label>
              <Input value={telecallerPhone} onChange={(e) => setTelecallerPhone(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} loading={pending} disabled={!customerName.trim() || !contactNo.trim()}>
              Save changes
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
