import { Skeleton, SkeletonHeader } from '@/components/ui/skeleton';

export default function ImportLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      {/* Mode tabs */}
      <Skeleton className="h-9 w-72 rounded-lg" />
      {/* Wizard card */}
      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="mt-2 h-9 w-64" />
      </div>
    </div>
  );
}
