import Link from 'next/link';

const linkClass =
  'inline-flex items-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--muted-surface)]';

/**
 * Prev/Next pager shared by the paginated list views. Renders nothing when
 * there is a single page. `hrefFor` builds the URL for a given page; navigating
 * is a normal `<Link>` so the route-level `loading.tsx` skeleton shows while the
 * next page loads. `note` is optional trailing context (e.g. "export contains all 260").
 */
export function Pagination({
  page,
  totalPages,
  hrefFor,
  note,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  note?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--muted)]">
        Page {page} of {totalPages}
        {note ? ` · ${note}` : ''}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={hrefFor(page - 1)} className={linkClass}>
            Previous
          </Link>
        )}
        {page < totalPages && (
          <Link href={hrefFor(page + 1)} className={linkClass}>
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
