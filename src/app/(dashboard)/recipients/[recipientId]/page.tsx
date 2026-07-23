import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLanguageMap, langName } from '@/lib/domain/languages';
import { StatusBadge } from '@/components/status-badge';
import { RecipientActions } from './recipient-actions';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui/primitives';
import { formatDate, formatDateTime, titleCase } from '@/lib/utils';
import { CALL_TYPE_LABELS, OUTCOME_LABELS } from '@/lib/domain/labels';

export const dynamic = 'force-dynamic';

const EVENT_LABELS: Record<string, string> = {
  imported: 'Imported',
  call_attempt: 'Call attempt',
  status_change: 'Status change',
  dispatch: 'Dispatch',
  edit: 'Agent edit',
  voc_sealed: 'VOC sealed',
};

function eventSummary(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case 'status_change':
      return `${titleCase(String(payload.from ?? ''))} → ${titleCase(String(payload.to ?? ''))}`;
    case 'call_attempt':
      return `${CALL_TYPE_LABELS[payload.call_type as 'order_confirmation'] ?? payload.call_type} · ${
        payload.outcome ? OUTCOME_LABELS[payload.outcome as 'confirmed'] ?? payload.outcome : ''
      }${payload.language ? ` · ${payload.language}` : ''}${
        payload.language_defaulted ? ' (defaulted)' : ''
      }`;
    case 'dispatch':
      return `${titleCase(String(payload.stage ?? ''))}${payload.courier ? ` · ${payload.courier}` : ''}`;
    case 'voc_sealed':
      return `Sealed ${payload.sealed_voc_id ?? ''}`;
    case 'edit':
      return `${titleCase(String(payload.action ?? 'edit'))}${payload.note ? ` — ${payload.note}` : ''}`;
    default:
      return '';
  }
}

export default async function RecipientPage({
  params,
}: {
  params: Promise<{ recipientId: string }>;
}) {
  const { recipientId } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: recipient } = await supabase
    .from('recipients')
    .select('*, campaigns(id, calling_from)')
    .eq('id', recipientId)
    .single();
  if (!recipient) notFound();

  const [{ data: events }, { data: calls }, { data: dispatch }, { data: voc }, langMap] =
    await Promise.all([
      supabase
        .from('recipient_events')
        .select('*')
        .eq('recipient_id', recipientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('call_attempts')
        .select('*')
        .eq('recipient_id', recipientId)
        .order('created_at', { ascending: false }),
      supabase.from('dispatches').select('*').eq('recipient_id', recipientId).maybeSingle(),
      supabase.from('voc_recordings').select('*').eq('recipient_id', recipientId).maybeSingle(),
      getLanguageMap(supabase),
    ]);

  const campaign = Array.isArray(recipient.campaigns)
    ? recipient.campaigns[0]
    : recipient.campaigns;

  const lastOrderCall = (calls ?? []).find((c) => c.call_type === 'order_confirmation');
  const isOrderEscalation = lastOrderCall?.outcome === 'transferred_to_agent';

  return (
    <div className="space-y-5">
      <div>
        {campaign && (
          <Link
            href={`/recipients?campaign=${campaign.id}`}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ← {campaign.calling_from}
          </Link>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{recipient.customer_name ?? 'Unnamed'}</h1>
          <StatusBadge status={recipient.status} />
          {recipient.preferred_language && (
            <Badge color="indigo">{langName(langMap, recipient.preferred_language)}</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column: details + actions */}
        <div className="space-y-5 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label="Contact" value={recipient.contact_no_e164 ?? recipient.contact_no} mono />
              <Field label="Product" value={recipient.product_name} />
              <Field label="Delivery date" value={formatDate(recipient.product_delivery_date)} />
              <Field label="Address" value={recipient.address} />
              <Field
                label="Language source"
                value={recipient.language_source ? titleCase(recipient.language_source) : '—'}
              />
              {recipient.missing_address && <Badge color="amber">Missing address</Badge>}
            </CardContent>
          </Card>

          {dispatch && (
            <Card>
              <CardHeader>
                <CardTitle>Dispatch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Courier" value={dispatch.courier_name} />
                <Field label="AWB" value={dispatch.awb_number} mono />
                <Field label="Dispatched" value={formatDate(dispatch.dispatch_date)} />
                <Field label="Delivered" value={formatDate(dispatch.delivered_date)} />
              </CardContent>
            </Card>
          )}

          {voc && (
            <Card>
              <CardHeader>
                <CardTitle>Sealed VOC</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Badge color="green">{voc.sealed_voc_id}</Badge>
                <Field label="Language" value={langName(langMap, voc.language)} />
                <Field label="Duration" value={`${voc.duration_seconds ?? 0}s`} />
              </CardContent>
            </Card>
          )}

          <RecipientActions
            recipientId={recipient.id}
            status={recipient.status}
            isOrderEscalation={isOrderEscalation}
            currentAddress={recipient.address}
          />
        </div>

        {/* Right column: timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {(events ?? []).map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {EVENT_LABELS[e.event_type] ?? titleCase(e.event_type)}
                        </span>
                        <span className="text-xs text-[var(--muted)]">
                          {formatDateTime(e.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--muted)]">
                        {eventSummary(e.event_type, e.payload)}
                      </p>
                      <Badge color="slate">{e.actor_type}</Badge>
                    </div>
                  </li>
                ))}
                {!(events ?? []).length && (
                  <p className="py-6 text-center text-sm text-[var(--muted)]">No events yet.</p>
                )}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={mono ? 'text-right font-mono text-xs' : 'text-right'}>{value ?? '—'}</span>
    </div>
  );
}
