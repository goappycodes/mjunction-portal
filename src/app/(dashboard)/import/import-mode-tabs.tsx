import Link from 'next/link';
import { cn } from '@/lib/utils';

export type ImportMode = 'import' | 'delivery';

const TABS: { mode: ImportMode; label: string }[] = [
  { mode: 'import', label: 'Import recipients' },
  { mode: 'delivery', label: 'Bulk mark delivered' },
];

/** Switches the Import page between the recipient-import wizard and the bulk-delivery wizard, preserving the selected campaign. */
export function ImportModeTabs({ mode, campaignId }: { mode: ImportMode; campaignId?: string }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted-surface)] p-1">
      {TABS.map((t) => {
        const params = new URLSearchParams();
        params.set('mode', t.mode);
        if (campaignId) params.set('campaign', campaignId);
        const active = mode === t.mode;
        return (
          <Link
            key={t.mode}
            href={`/import?${params.toString()}`}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
