import Link from 'next/link';
import { cn } from '@/lib/utils';

export type VocTab = 'address' | 'delivery';

const TABS: { tab: VocTab; label: string }[] = [
  { tab: 'address', label: 'Address Verification' },
  { tab: 'delivery', label: 'Delivery Confirmation' },
];

/**
 * Switches VOC & Reports between the order-confirmation call log and the
 * delivery-confirmation call log, preserving the other active filters.
 * Same URL-param-driven pill pattern as ImportModeTabs — no generic Tabs
 * primitive exists in the design system, and introducing one just for this
 * would be more than this needs.
 */
export function VocTabs({
  tab,
  otherParams,
}: {
  tab: VocTab;
  otherParams: Record<string, string | undefined>;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted-surface)] p-1">
      {TABS.map((t) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(otherParams)) {
          if (value) params.set(key, value);
        }
        params.set('view', t.tab);
        const active = tab === t.tab;
        return (
          <Link
            key={t.tab}
            href={`/voc?${params.toString()}`}
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
