'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { retryCall } from '@/app/actions/calls';
import { Button } from '@/components/ui/button';

export function RetryButton({ recipientId }: { recipientId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        onClick={() =>
          start(async () => {
            const res = await retryCall(recipientId);
            if (res.error) setError(res.error);
            else router.refresh();
          })
        }
        loading={pending}
      >
        {pending ? 'Retrying…' : 'Retry call'}
      </Button>
      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  );
}
