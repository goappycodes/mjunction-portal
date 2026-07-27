import * as React from 'react';
import { Card } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * Centered "nothing here" placeholder used across list pages. Replaces the
 * repeated `<Card className="p-12 text-center"><p className="text-sm …">` block.
 */
export function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('p-12 text-center', className)}>
      <p className="text-sm text-[var(--muted)]">{children}</p>
    </Card>
  );
}
