import { Skeleton, SkeletonHeader, SkeletonTable } from '@/components/ui/skeleton';

export default function RecipientsHubLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      {/* Filter card: search + controls */}
      <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <SkeletonTable rows={12} cols={9} />
    </div>
  );
}
