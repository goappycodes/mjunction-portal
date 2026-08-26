import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLanguageMap, langName } from '@/lib/domain/languages';
import { StatusBadge } from '@/components/status-badge';
import { BackButton } from '@/components/back-button';
import { RecipientActions } from './recipient-actions';
import { RecipientEditButton } from './recipient-edit-button';
import { RecipientRollback } from './recipient-rollback';
import { RecipientStatusOverride } from './recipient-status-override';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui/primitives';
import { formatDate, formatDateTime, titleCase } from '@/lib/utils';
import { CALL_TYPE_LABELS, OUTCOME_LABELS } from '@/lib/domain/labels';
import { ORDER_ROLLBACK_ENABLED } from '@/lib/env';

export const dynamic = 'force-dynamic';

const EVENT_LABELS: Record<string, string> = {
  imported: 'Imported',
  call_attempt: 'Call attempt',
  status_change: 'Status change',
  dispatch: 'Dispatch',
  edit: 'Agent edit',
  voc_sealed: 'VOC sealed',
  rollback: 'Rolled back',
};

function eventSummary(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case 'status_change':
    case 'rollback':
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
  const user = await requireUser();
  const supabase = await createClient();

  const { data: recipient } = await supabase
    .from('recipients')
    .select('*')
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

  // Which half of the pipeline an escalation came from. Every press-2 now lands
  // on `issue_raised` regardless of script, so the status no longer says which
  // — the most recent call's type does. Must stay in step with
  // `escalationPhase` in app/actions/agent.ts, which re-derives this
  // server-side before allowing a resolution (same query, same default).
  // `calls` is already ordered newest-first.
  const isOrderEscalation = ((calls ?? [])[0]?.call_type ?? 'order_confirmation') ===
    'order_confirmation';

  return (
    <div className="space-y-5">
      <div>
        <BackButton fallbackHref="/orders" />
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
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Details</CardTitle>
              {user.role === 'admin' && <RecipientEditButton recipient={recipient} />}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label="Company" value={recipient.company_name} />
              <Field label="Contact" value={recipient.contact_no_e164 ?? recipient.contact_no} mono />
              <Field label="Email" value={recipient.email} mono />
              <Field label="Product" value={recipient.product_name} />
              <Field label="Delivery date" value={formatDate(recipient.product_delivery_date)} />
              <Field label="Address" value={recipient.address} />
              <Field label="Telecaller" value={recipient.telecaller_name} />
              <Field label="Telecaller contact" value={recipient.telecaller_phone} mono />
              <Field
                label="Language source"
                value={recipient.language_source ? titleCase(recipient.language_source) : '—'}
              />
              {recipient.missing_address && <Badge color="amber">Missing address</Badge>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order (mjunction)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label="Order ID" value={recipient.order_id} mono />
              <Field label="Order Item ID" value={recipient.unique_id} mono />
              <Field label="Order date" value={formatDate(recipient.order_date)} />
              <Field label="Vendor PO number" value={recipient.vendor_po_number} mono />
              <Field label="Vendor dispatch id" value={recipient.vendor_dispatch_id} mono />
              <Field
                label="Quantity"
                value={
                  recipient.ordered_quantity != null || recipient.dispatch_quantity != null
                    ? `${recipient.ordered_quantity ?? '—'} ordered / ${recipient.dispatch_quantity ?? '—'} dispatched`
                    : null
                }
              />
              <Field label="Courier (import)" value={recipient.courier_name} />
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

          {!!(calls ?? []).length && (
            <Card>
              <CardHeader>
                <CardTitle>Calls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {(calls ?? []).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start justify-between gap-2 border-b border-[var(--border)] pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="font-medium">
                        {CALL_TYPE_LABELS[c.call_type] ?? c.call_type}
                        <span className="ml-1 text-[var(--muted)]">#{c.attempt_number}</span>
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {c.outcome ? OUTCOME_LABELS[c.outcome] ?? c.outcome : 'Pending'}
                        {c.dtmf_response ? ` · pressed ${c.dtmf_response}` : ''}
                        {' · '}
                        {formatDateTime(c.created_at)}
                      </div>
                    </div>
                    {c.recording_url && (
                      <a
                        href={c.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-medium text-[var(--primary)] hover:underline"
                      >
                        Recording
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <RecipientActions
            recipientId={recipient.id}
            status={recipient.status}
            isOrderEscalation={isOrderEscalation}
            currentAddress={recipient.address}
          />

          {user.role === 'admin' && (
            <RecipientStatusOverride recipientId={recipient.id} status={recipient.status} />
          )}

          {ORDER_ROLLBACK_ENABLED && (
            <RecipientRollback recipientId={recipient.id} status={recipient.status} />
          )}
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
                        {eventSummary(e.event_type, (e.payload ?? {}) as Record<string, unknown>)}
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
