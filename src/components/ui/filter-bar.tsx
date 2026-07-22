import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * A styled GET-form filter bar used across list pages. Server-component
 * friendly — render inputs/selects as children and it submits via query string.
 */
export function FilterBar({
  action,
  children,
  resetHref,
  className,
}: {
  action?: string;
  children: React.ReactNode;
  resetHref?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      method="get"
      className={cn(
        'flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm',
        className,
      )}
    >
      {children}
      <div className="ml-auto flex items-end gap-2">
        <Button type="submit" variant="secondary" size="sm">
          Apply filters
        </Button>
        {resetHref && (
          <a
            href={resetHref}
            className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Reset
          </a>
        )}
      </div>
    </form>
  );
}

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}
