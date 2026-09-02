import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { ChangeAddressForm } from './change-address-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Update your delivery address',
  robots: { index: false, follow: false },
};

export default async function ChangeAddressPage({
  params,
}: {
  params: Promise<{ recipientId: string }>;
}) {
  const { recipientId } = await params;

  // Public, unauthenticated route: read on the service-role client, scoped to
  // the single row addressed by its unguessable UUID.
  const supabase = createServiceClient();
  const { data: recipient } = await supabase
    .from('recipients')
    .select(
      'id, customer_name, contact_no, contact_no_e164, company_name, order_id, product_name, address',
    )
    .eq('id', recipientId)
    .single();
  if (!recipient) notFound();

  const phone = recipient.contact_no_e164 ?? recipient.contact_no;

  return (
    <main className="min-h-full bg-[var(--background)] px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <header className="space-y-1.5 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            Update your delivery address
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Please confirm the details below and provide the correct address for your delivery.
          </p>
        </header>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.06)]">
          <dl className="space-y-3 text-sm">
            <Row label="Name" value={recipient.customer_name} />
            <Row label="Phone" value={phone} mono />
            <Row label="Company" value={recipient.company_name} />
            <Row label="Order ID" value={recipient.order_id} mono />
            <Row label="Product to receive" value={recipient.product_name} />
            <Row label="Current address" value={recipient.address} />
          </dl>
        </section>

        <ChangeAddressForm
          recipientId={recipient.id}
          currentAddress={recipient.address ?? ''}
        />
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-[var(--muted)]">{label}</dt>
      <dd
        className={
          mono
            ? 'font-mono text-xs text-[var(--foreground)] sm:text-right'
            : 'text-[var(--foreground)] sm:text-right'
        }
      >
        {value?.trim() ? value : '—'}
      </dd>
    </div>
  );
}
