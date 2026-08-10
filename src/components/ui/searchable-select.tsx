'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sub?: string | null;
}

/**
 * Controlled searchable combobox — same look/behaviour as `CampaignSelector`
 * (type to filter, click to choose) but generic (value/onChange instead of
 * URL navigation) so it can drop into staged filter state like `TableFilters`.
 * Pass `allLabel` to prepend a "clear" option with value `''`.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyLabel = 'No results found.',
  allLabel,
  className,
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allOptions = useMemo(
    () => (allLabel ? [{ value: '', label: allLabel }, ...options] : options),
    [options, allLabel],
  );
  const selected = allOptions.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sub ?? '').toLowerCase().includes(q),
    );
  }, [allOptions, query]);

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

  function choose(v: string) {
    onChange(v);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-left text-sm shadow-sm transition-colors hover:bg-[var(--muted-surface)] focus-visible:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40"
      >
        <span className={cn('truncate', !selected && 'text-[var(--muted)]')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--muted)]" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[16rem] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent text-sm placeholder:text-[var(--muted)] focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {filtered.length ? (
              filtered.map((o) => {
                const active = o.value === value;
                return (
                  <li key={o.value || '__all__'}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => choose(o.value)}
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
                        <span className="block truncate font-medium">{o.label}</span>
                        {o.sub && (
                          <span className="block truncate text-xs text-[var(--muted)]">{o.sub}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-6 text-center text-sm text-[var(--muted)]">{emptyLabel}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
