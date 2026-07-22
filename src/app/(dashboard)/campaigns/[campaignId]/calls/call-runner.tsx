'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runCallBatch, type BatchResult } from '@/app/actions/calls';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import type { CallType } from '@/lib/database.types';

export function CallRunner({
  campaignId,
  orderEligible,
  deliveryEligible,
}: {
  campaignId: string;
  orderEligible: number;
  deliveryEligible: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ type: CallType; res: BatchResult } | null>(null);
  const [running, setRunning] = useState<CallType | null>(null);

  function run(callType: CallType) {
    setRunning(callType);
    setResult(null);
    startTransition(async () => {
      const res = await runCallBatch({ campaignId, callType });
      setResult({ type: callType, res });
      setRunning(null);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Order-Confirmation batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Language menu (1=Hindi / 2=English default), read address, press-1 confirm /
            press-2 escalate. No-answer → retry then unreachable.
          </p>
          <p className="text-sm">
            <span className="font-semibold">{orderEligible}</span> recipient(s) eligible
          </p>
          <Button
            onClick={() => run('order_confirmation')}
            loading={running === 'order_confirmation'}
            disabled={pending || orderEligible === 0}
          >
            {running === 'order_confirmation' ? 'Running…' : 'Run order-confirm batch'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery-Confirmation batch (VOC)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Names product + date in the known language (press-9 to change),
            press-1 confirms &amp; seals a VOC / press-2 raises an issue.
          </p>
          <p className="text-sm">
            <span className="font-semibold">{deliveryEligible}</span> recipient(s) eligible
          </p>
          <Button
            onClick={() => run('delivery_confirmation')}
            loading={running === 'delivery_confirmation'}
            disabled={pending || deliveryEligible === 0}
          >
            {running === 'delivery_confirmation' ? 'Running…' : 'Run delivery-confirm batch'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="md:col-span-2">
          <Card>
            <CardContent className="pt-5">
              {result.res.error ? (
                <p className="text-sm text-[var(--danger)]">{result.res.error}</p>
              ) : (
                <div className="flex flex-wrap gap-6 text-sm">
                  <span>
                    Placed: <strong>{result.res.placed}</strong>
                  </span>
                  <span className="text-[var(--success)]">
                    Confirmed: <strong>{result.res.confirmed}</strong>
                  </span>
                  <span className="text-[var(--warning)]">
                    Escalated: <strong>{result.res.escalated}</strong>
                  </span>
                  <span className="text-[var(--danger)]">
                    Unreachable: <strong>{result.res.unreachable}</strong>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
