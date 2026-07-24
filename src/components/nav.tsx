'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Megaphone,
  PhoneForwarded,
  PhoneMissed,
  Users,
  LogOut,
  PhoneCall,
  Upload,
  ClipboardList,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/database.types';
import { signOut } from '@/app/actions/auth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    heading: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { href: '/import', label: 'Import', icon: Upload, adminOnly: true },
      { href: '/recipients', label: 'Recipients', icon: ClipboardList },
      { href: '/voc', label: 'VOC & Reports', icon: FileText },
    ],
  },
  {
    heading: 'Telecaller queues',
    items: [
      { href: '/queue/escalations', label: 'Escalations', icon: PhoneForwarded },
      { href: '/queue/unreachable', label: 'Unreachable', icon: PhoneMissed },
    ],
  },
  {
    heading: 'Administration',
    items: [{ href: '/admin/users', label: 'Users & roles', icon: Users, adminOnly: true }],
  },
];

function initials(name: string | null, email: string | null): string {
  const src = (name ?? email ?? '?').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function Nav({
  role,
  fullName,
  email,
}: {
  role: UserRole;
  fullName: string | null;
  email: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside
      className="sidebar-scroll sticky top-0 flex h-screen w-64 shrink-0 flex-col self-start overflow-y-auto"
      style={{ background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)' }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--sidebar-active)] text-white shadow-lg shadow-indigo-900/40">
          <PhoneCall className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-[var(--sidebar-fg-strong)]">Gifting VOC</p>
          <p className="text-xs text-[var(--sidebar-muted)]">Admin Panel</p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 space-y-6 px-3 py-2">
        {GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.adminOnly || role === 'admin');
          if (!items.length) return null;
          return (
            <div key={group.heading}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--sidebar-muted)]">
                {group.heading}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        active
                          ? 'bg-[var(--sidebar-active-soft)] text-[var(--sidebar-fg-strong)]'
                          : 'text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-fg-strong)]',
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--sidebar-active)]" />
                      )}
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px] transition-colors',
                          active
                            ? 'text-[var(--sidebar-active)]'
                            : 'text-[var(--sidebar-muted)] group-hover:text-[var(--sidebar-fg)]',
                        )}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div
        className="border-t p-3"
        style={{ borderColor: 'var(--sidebar-border)', background: 'var(--sidebar-bg-2)' }}
      >
        <div className="mb-2 flex items-center gap-3 px-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sidebar-active)] text-xs font-semibold text-white">
            {initials(fullName, email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--sidebar-fg-strong)]">
              {fullName ?? email}
            </p>
            <p className="text-xs capitalize text-[var(--sidebar-muted)]">{role}</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--sidebar-fg)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-fg-strong)]"
          >
            <LogOut className="h-[18px] w-[18px] text-[var(--sidebar-muted)]" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
