'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { submitAddressChange } from '@/app/actions/public-address';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/primitives';

export function ChangeAddressForm({
  recipientId,
  currentAddress,
}: {
  recipientId: string;
  currentAddress: string;
}) {
  const [address, setAddress] = useState(currentAddress);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await submitAddressChange(recipientId, address);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.06)]">
        <CheckCircle2 className="mx-auto h-9 w-9 text-[var(--success)]" />
        <h2 className="mt-3 text-base font-semibold text-[var(--foreground)]">
          Address updated
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Thank you. Your delivery address has been saved. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.06)]"
    >
      <div className="space-y-1.5">
        <Label htmlFor="address">New delivery address</Label>
        <Textarea
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={4}
          placeholder="House / flat no., street, area, city, state, PIN code"
          autoFocus
        />
      </div>

      {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

      <div className="mt-4 flex justify-end">
        <Button type="submit" loading={pending} disabled={!address.trim()}>
          Save address
        </Button>
      </div>
    </form>
  );
}
