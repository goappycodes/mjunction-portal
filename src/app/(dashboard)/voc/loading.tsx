import {
  Skeleton,
  SkeletonHeader,
  SkeletonTable,
} from '@/components/ui/skeleton';

export default function VocReportsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      {/* Filter bar: search + export buttons, then selects + apply/reset */}
      <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-full max-w-sm" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <SkeletonTable rows={10} cols={14} />
    </div>
  );
}
