'use client';

import { useState, useTransition } from 'react';
import { getSignedVocUrl } from '@/app/actions/voc';
import { Button } from '@/components/ui/button';

export function VocPlayer({ vocId }: { vocId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function load() {
    setError(null);
    start(async () => {
      const res = await getSignedVocUrl(vocId);
      if (res.error) setError(res.error);
      else setUrl(res.url ?? null);
    });
  }

  if (url) {
    return (
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={url} className="h-8 max-w-[220px]" />
        <a href={url} download className="text-xs text-[var(--primary)] hover:underline">
          Download
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={load} loading={pending}>
        {pending ? 'Signing…' : 'Play'}
      </Button>
      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  );
}
