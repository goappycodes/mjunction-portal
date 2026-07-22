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

const ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/queue/escalations', label: 'Escalations', icon: PhoneForwarded },
  { href: '/queue/unreachable', label: 'Unreachable', icon: PhoneMissed },
  { href: '/admin/users', label: 'Users', icon: Users, adminOnly: true },
];

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
  const items = ITEMS.filter((i) => !i.adminOnly || role === 'admin');

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="px-5 py-5">
        <p className="text-sm font-semibold leading-tight">Gifting VOC</p>
        <p className="text-xs text-[var(--muted)]">Admin Panel</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
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
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--muted-surface)]',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border)] p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium">{fullName ?? email}</p>
          <p className="text-xs capitalize text-[var(--muted)]">{role}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted-surface)]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
