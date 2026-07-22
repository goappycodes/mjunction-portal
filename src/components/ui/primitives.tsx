import * as React from 'react';
import { cn } from '@/lib/utils';

/* ---------------- Card ---------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.06)]',
        className,
      )}
      {...props}
    />
  );
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pt-5 pb-3', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold', className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-[var(--muted)]', className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />;
}

/* ---------------- Input / Label / Textarea / Select ---------------- */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm shadow-sm transition-colors placeholder:text-[var(--muted)] focus-visible:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40 disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-[80px] w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm shadow-sm transition-colors focus-visible:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40',
      className,
    )}
    {...props}
  />
));
Select.displayName = 'Select';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-sm font-medium text-[var(--foreground)]', className)}
      {...props}
    />
  );
}

/* ---------------- Badge ---------------- */
const badgeColors: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  purple: 'bg-purple-100 text-purple-700',
};

export function Badge({
  color = 'slate',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { color?: keyof typeof badgeColors }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        badgeColors[color] ?? badgeColors.slate,
        className,
      )}
      {...props}
    />
  );
}
