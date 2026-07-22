'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function CampaignTabs({
  campaignId,
  isAdmin,
}: {
  campaignId: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const base = `/campaigns/${campaignId}`;

  const tabs: { href: string; label: string; adminOnly?: boolean }[] = [
    { href: base, label: 'Overview' },
    { href: `${base}/recipients`, label: 'Recipients' },
    { href: `${base}/import`, label: 'Import', adminOnly: true },
    { href: `${base}/calls`, label: 'Calls' },
    { href: `${base}/dispatch`, label: 'Dispatch', adminOnly: true },
    { href: `${base}/voc`, label: 'VOC vault' },
    { href: `${base}/language`, label: 'Language', adminOnly: true },
    { href: `${base}/reports`, label: 'Reports' },
  ];

  const visible = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <nav className="flex flex-wrap gap-1 border-b border-[var(--border)]">
      {visible.map((t) => {
        const active = t.href === base ? pathname === base : pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active
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
