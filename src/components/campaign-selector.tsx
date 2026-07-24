'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CampaignOption {
  id: string;
  label: string;
  sub?: string | null;
}

/**
 * Searchable campaign dropdown used by the Import page. Campaigns are passed
 * already sorted (latest first); selecting one navigates to
 * `${basePath}?campaign=<id>` while preserving any params in `preserve`.
 * (Recipients and VOC & Reports select the campaign inline via `TableFilters`.)
 */
export function CampaignSelector({
  campaigns,
  selectedId,
  basePath,
  preserve,
  className,
}: {
  campaigns: CampaignOption[];
  selectedId?: string | null;
  basePath: string;
  preserve?: Record<string, string | undefined>;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.sub ?? '').toLowerCase().includes(q),
    );
  }, [campaigns, query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Focus the search box when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function choose(id: string) {
    const params = new URLSearchParams();
    params.set('campaign', id);
    for (const [k, v] of Object.entries(preserve ?? {})) {
      if (v) params.set(k, v);
    }
    setOpen(false);
    setQuery('');
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div ref={rootRef} className={cn('relative w-full max-w-sm', className)}>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        Campaign
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-left text-sm shadow-sm transition-colors hover:bg-[var(--muted-surface)] focus-visible:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40"
      >
        <span className={cn('truncate', !selected && 'text-[var(--muted)]')}>
          {selected ? selected.label : 'Select a campaign…'}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--muted)]" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campaigns…"
              className="h-9 w-full bg-transparent text-sm placeholder:text-[var(--muted)] focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {filtered.length ? (
              filtered.map((c) => {
                const active = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => choose(c.id)}
                      className={cn(
                        'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--muted-surface)]',
                        active && 'bg-[var(--muted-surface)]',
                      )}
                    >
                      <Check
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          active ? 'text-[var(--primary)]' : 'opacity-0',
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.label}</span>
                        {c.sub && (
                          <span className="block truncate text-xs text-[var(--muted)]">
                            {c.sub}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-6 text-center text-sm text-[var(--muted)]">
                No campaigns found.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
