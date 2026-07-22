import { Card } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  sub,
  accent,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'indigo' | 'green' | 'amber' | 'red';
  className?: string;
}) {
  const accentColor =
    accent === 'green'
      ? 'var(--success)'
      : accent === 'amber'
        ? 'var(--warning)'
        : accent === 'red'
          ? 'var(--danger)'
          : 'var(--primary)';
  return (
    <Card className={cn('relative overflow-hidden p-5', className)}>
      {accent && (
        <span
          className="absolute left-0 top-0 h-full w-1"
          style={{ background: accentColor }}
        />
      )}
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
    </Card>
  );
}
