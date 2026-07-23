import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface SectionTab {
  view: string;
  label: string;
}

/**
 * Sub-view tab bar for the merged sidebar pages (Recipients / Calls / Dispatch
 * and VOC / Reports). Each tab links to the same page with `?campaign=<id>&view=<view>`,
 * intentionally dropping the previous view's filters so each view starts clean.
 */
export function SectionTabs({
  basePath,
  campaignId,
  active,
  tabs,
}: {
  basePath: string;
  campaignId: string;
  active: string;
  tabs: SectionTab[];
}) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-[var(--border)]">
      {tabs.map((t) => {
        const isActive = t.view === active;
        const params = new URLSearchParams({ campaign: campaignId, view: t.view });
        return (
          <Link
            key={t.view}
            href={`${basePath}?${params.toString()}`}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
