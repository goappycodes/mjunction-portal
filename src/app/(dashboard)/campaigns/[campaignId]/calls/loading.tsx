import {
  Skeleton,
  SkeletonFilterBar,
  SkeletonTable,
} from '@/components/ui/skeleton';

export default function CallsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-3 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-3/4" />
            <Skeleton className="mt-4 h-9 w-40" />
          </div>
        ))}
      </div>
      <SkeletonFilterBar />
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}
