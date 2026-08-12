'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { rollbackOrder } from '@/app/actions/rollback';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Card, CardContent, CardHeader, CardTitle, Select, Label } from '@/components/ui/primitives';
import { getRollbackTargets } from '@/lib/domain/rollback';
import { statusLabel } from '@/lib/domain/labels';
import type { RecipientStatus } from '@/lib/database.types';

/**
 * Dev/test-only "rollback" tool — only rendered when ENABLE_ORDER_ROLLBACK is
 * set (see page.tsx). Forces the recipient back to an earlier pipeline status
 * and deletes everything recorded since (call attempts, dispatch/VOC, and
 * timeline events) via app/actions/rollback.ts.
 */
export function RecipientRollback({
  recipientId,
  status,
}: {
  recipientId: string;
  status: RecipientStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = getRollbackTargets(status);
  const [target, setTarget] = useState<RecipientStatus | ''>(targets[0] ?? '');

  if (!targets.length) return null;

  function submit() {
    if (!target) return;
    setError(null);
    start(async () => {
      const res = await rollbackOrder({ recipientId, targetStatus: target });
      if (res.error) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Card className="border-[var(--danger)]/40">
      <CardHeader>
        <CardTitle className="text-[var(--danger)]">Developer tools</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          Rollback order…
        </Button>
      </CardContent>

      <Modal open={open} onClose={() => setOpen(false)} title="Rollback order">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Roll back to</Label>
            <Select
              value={target}
              onChange={(e) => setTarget(e.target.value as RecipientStatus)}
            >
              {targets.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
          </div>

          <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-3 text-sm text-[var(--danger)]">
            <p className="font-medium">This cannot be undone.</p>
            <p className="mt-1">
              This permanently deletes every call record, dispatch/VOC record, and timeline event
              recorded after this order last reached &ldquo;{target && statusLabel(target)}&rdquo;,
              and sets its status back to that stage.
            </p>
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={submit} loading={pending} disabled={!target}>
              Yes, roll back
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
