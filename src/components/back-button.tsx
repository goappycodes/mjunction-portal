'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Browser-history back button for a detail/view page. Prefers `router.back()`
 * so it returns to wherever the user actually came from (a filtered list, a
 * search, a different queue) — `fallbackHref` only covers the case where
 * there's no in-app history to go back to, e.g. the page was opened directly
 * via a bookmarked/shared URL.
 */
export function BackButton({
  fallbackHref,
  label = 'Back',
}: {
  fallbackHref: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </Button>
  );
}
