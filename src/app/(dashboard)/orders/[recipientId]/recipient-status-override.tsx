'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateRecipientStatus } from '@/app/actions/recipients';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Label,
  Textarea,
} from '@/components/ui/primitives';
import { ALL_STATUSES } from '@/lib/domain/status';
import { statusLabel } from '@/lib/domain/labels';
import type { RecipientStatus } from '@/lib/database.types';

/**
 * Admin-only manual status override.
 *
 * Lists every status, not just the ones reachable from the current one — this
 * is the tool for fixing a recipient that is already in the wrong state, which
 * is exactly the case the status machine refuses to move out of. The server
 * action re-checks the admin role and records the change as a manual override
 * on the timeline, so a hand-set status stays distinguishable from one the
 * pipeline produced.
 *
 * Distinct from RecipientRollback (dev-only), which also *deletes* the call
 * attempts, dispatch/VOC rows and timeline events recorded since the target
 * status. This only moves the status; nothing is erased.
 */
export function RecipientStatusOverride({
  recipientId,
  status,
}: {
  recipientId: string;
  status: RecipientStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<RecipientStatus>(status);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dirty = target !== status;

  function submit() {
    if (!dirty) return;
    setError(null);
    start(async () => {
      const res = await updateRecipientStatus({ recipientId, status: target, note });
      if (res.error) setError(res.error);
      else {
        setNote('');
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-[var(--muted)]">
          Admin override — sets the status directly, skipping the normal pipeline rules.
          Recorded on the timeline as a manual change.
        </p>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={target}
            onChange={(e) => setTarget(e.target.value as RecipientStatus)}
            disabled={pending}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
                {s === status ? ' (current)' : ''}
              </option>
            ))}
          </Select>
        </div>
        <Textarea
          placeholder="Reason (optional) — why this was changed by hand"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          disabled={pending}
        />
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <Button onClick={submit} loading={pending} disabled={!dirty}>
          {dirty ? `Set to ${statusLabel(target)}` : 'No change'}
        </Button>
      </CardContent>
    </Card>
  );
}
