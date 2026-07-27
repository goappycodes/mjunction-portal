import {
  Skeleton,
  SkeletonHeader,
  SkeletonTable,
} from '@/components/ui/skeleton';

export default function VocReportsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      {/* Campaign selector */}
      <Skeleton className="h-9 w-full max-w-sm" />
      {/* Search box */}
      <Skeleton className="h-9 w-full max-w-xl" />
      {/* Filter + export bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-20" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <SkeletonTable rows={10} cols={12} />
    </div>
  );
}
