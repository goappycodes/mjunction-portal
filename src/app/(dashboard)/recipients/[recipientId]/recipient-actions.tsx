'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resolveOrderEscalation, resolveDeliveryIssue, markUnreachable } from '@/app/actions/agent';
import { retryCall } from '@/app/actions/calls';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Textarea, Label } from '@/components/ui/primitives';
import type { RecipientStatus } from '@/lib/database.types';

export function RecipientActions({
  recipientId,
  status,
  isOrderEscalation,
  currentAddress,
}: {
  recipientId: string;
  status: RecipientStatus;
  isOrderEscalation: boolean;
  currentAddress: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [address, setAddress] = useState(currentAddress ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function done(res: { error?: string; ok?: boolean }) {
    if (res.error) setError(res.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  // An `issue_raised` recipient can come from either half of the pipeline now
  // that every press-2 lands there, and the two are resolved differently — the
  // order half by capturing the corrected address, the delivery half by
  // closing with a note. `isOrderEscalation` (derived from the latest call's
  // type on the server) is what tells them apart.
  const showOrderEscalation =
    isOrderEscalation &&
    (status === 'issue_raised' ||
      status === 'order_confirm_pending' ||
      status === 'order_unreachable');
  const showIssue = status === 'issue_raised' && !isOrderEscalation;
  const showRetry = status === 'order_unreachable' || status === 'delivery_unreachable';
  // Offered wherever a call is still owed, so an agent who couldn't get
  // through can record that without waiting for an IVR attempt to fail.
  const showMarkUnreachable =
    status === 'imported' ||
    status === 'order_confirm_pending' ||
    status === 'delivery_confirm_pending';

  if (!showOrderEscalation && !showIssue && !showRetry && !showMarkUnreachable) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showOrderEscalation && (
          <div className="space-y-2">
            <Label>Corrected address (captured by agent — not STT)</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
            <Textarea
              placeholder="Agent note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  start(async () =>
                    done(
                      await resolveOrderEscalation({
                        recipientId,
                        correctedAddress: address,
                        note,
                      }),
                    ),
                  )
                }
                loading={pending}
              >
                Save corrected address
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  start(async () =>
                    done(
                      await resolveOrderEscalation({
                        recipientId,
                        correctedAddress: address,
                        note,
                        confirmedUnchanged: true,
                      }),
                    ),
                  )
                }
                disabled={pending}
              >
                Address unchanged — confirm
              </Button>
            </div>
          </div>
        )}

        {showIssue && (
          <div className="space-y-2">
            <Label>Resolution note</Label>
            <Textarea
              placeholder="How the delivery issue was handled…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
            <Button
              variant="success"
              onClick={() =>
                start(async () => done(await resolveDeliveryIssue({ recipientId, note })))
              }
              loading={pending}
            >
              Resolve &amp; close
            </Button>
          </div>
        )}

        {showRetry && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">
              Call this unreachable recipient back.
            </p>
            <Button
              onClick={() => start(async () => done(await retryCall(recipientId)))}
              loading={pending}
            >
              {pending ? 'Calling…' : 'Call back'}
            </Button>
          </div>
        )}

        {showMarkUnreachable && (
          <div className="space-y-2">
            <Label>Could not connect</Label>
            <p className="text-xs text-[var(--muted)]">
              Records a failed attempt and moves this recipient to the unreachable queue.
              The IVR does this automatically when a call doesn&apos;t connect — use this
              when there is no automatic result to go on.
            </p>
            <Textarea
              placeholder="Note (optional) — e.g. rang out, switched off"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <Button
              variant="secondary"
              onClick={() => start(async () => done(await markUnreachable({ recipientId, note })))}
              loading={pending}
            >
              Mark unreachable
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      </CardContent>
    </Card>
  );
}
