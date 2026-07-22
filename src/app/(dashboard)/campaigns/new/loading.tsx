import { Skeleton, SkeletonHeader } from '@/components/ui/skeleton';

export default function NewCampaignLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <SkeletonHeader />
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="ml-auto h-9 w-40" />
        </div>
      </div>
    </div>
  );
}
