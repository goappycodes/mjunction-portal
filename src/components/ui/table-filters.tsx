'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input, Select } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { FilterField } from '@/components/ui/filter-bar';
import { Spinner } from '@/components/ui/spinner';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';

const SEARCH_DEBOUNCE_MS = 350;

export interface FilterSelect {
  name: string;
  label: string;
  /** Tailwind width class for the select (default `w-48`). */
  width?: string;
  /** First entry should be the "all"/empty option with value `''`. */
  options: { value: string; label: string }[];
}

export interface FilterTextInput {
  name: string;
  label: string;
  placeholder?: string;
  /** Tailwind width class for the input (default `w-48`). */
  width?: string;
}

export interface FilterSearchableSelect {
  name: string;
  label: string;
  /** Tailwind width class for the control (default `w-56`). */
  width?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Label for the "clear" option, e.g. "All recipients". */
  allLabel: string;
  options: SearchableSelectOption[];
}

/**
 * Shared filter panel for the paginated table views (VOC & Reports,
 * Recipients & Calls). Search runs live (debounced) via `router.replace`
 * inside a transition so the table refreshes without a skeleton flash; the
 * selects and text inputs are staged locally and committed on "Apply";
 * "Reset" clears every filter. When `view` is set it is preserved so the
 * active section tab stays. `children` render to the right of the search box
 * (e.g. export buttons).
 *
 * Callers pass a `key` derived from the committed filter params so the staged
 * state re-seeds from the URL on Back/Forward, Apply and tab switches.
 */
export function TableFilters({
  basePath,
  view,
  searchKey = 'q',
  searchPlaceholder,
  selects,
  textInputs = [],
  searchableSelects = [],
  children,
}: {
  basePath: string;
  view?: string;
  searchKey?: string;
  searchPlaceholder: string;
  selects: FilterSelect[];
  /** Additional staged (Apply-triggered) free-text filters, e.g. an exact/partial ID lookup distinct from the live search box. */
  textInputs?: FilterTextInput[];
  /** Staged filters that need a searchable dropdown (large/unbounded option lists), e.g. lookup-by-recipient. */
  searchableSelects?: FilterSearchableSelect[];
  children?: ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const allFields = [...selects, ...textInputs, ...searchableSelects];

  const [q, setQ] = useState(params.get(searchKey) ?? '');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(allFields.map((f) => [f.name, params.get(f.name) ?? ''])),
  );

  // Track the latest params in a ref (written in an effect, never during
  // render) so the debounced navigation builds its URL from the freshest
  // query string even if the page changed during the debounce window.
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  // Build a URL from the latest params merged with `updates`; a null/empty
  // value drops the key. `view` is pinned and pagination resets to page 1.
  const hrefWith = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(paramsRef.current.toString());
    if (view) next.set('view', view);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page');
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Debounced live search — skips the initial render and any no-op change.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      if ((paramsRef.current.get(searchKey) ?? '') === q) return;
      start(() => router.replace(hrefWith({ [searchKey]: q || null })));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const applyFilters = () =>
    start(() =>
      router.push(
        hrefWith(Object.fromEntries(allFields.map((f) => [f.name, values[f.name] || null]))),
      ),
    );

  const resetFilters = () => {
    setQ('');
    setValues(Object.fromEntries(allFields.map((f) => [f.name, ''])));
    start(() => router.push(view ? `${basePath}?view=${view}` : basePath));
  };

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 pr-9"
            aria-label="Search"
          />
          {pending && (
            <Spinner size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          )}
        </div>
        {children && <div className="flex items-center gap-2 sm:ml-auto">{children}</div>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {textInputs.map((t) => (
          <FilterField key={t.name} label={t.label}>
            <Input
              value={values[t.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [t.name]: e.target.value }))}
              placeholder={t.placeholder}
              className={t.width ?? 'w-48'}
            />
          </FilterField>
        ))}
        {selects.map((s) => (
          <FilterField key={s.name} label={s.label}>
            <Select
              value={values[s.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [s.name]: e.target.value }))}
              className={s.width ?? 'w-48'}
            >
              {s.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FilterField>
        ))}
        {searchableSelects.map((s) => (
          <FilterField key={s.name} label={s.label} className="ml-auto">
            <SearchableSelect
              options={s.options}
              value={values[s.name] ?? ''}
              onChange={(v) => setValues((prev) => ({ ...prev, [s.name]: v }))}
              placeholder={s.placeholder}
              searchPlaceholder={s.searchPlaceholder}
              allLabel={s.allLabel}
              className={s.width ?? 'w-56'}
            />
          </FilterField>
        ))}

        <Button variant="primary" size="sm" onClick={applyFilters} disabled={pending}>
          Apply filters
        </Button>
        <Button variant="warning" size="sm" onClick={resetFilters} disabled={pending}>
          Reset
        </Button>
      </div>
    </div>
  );
}
