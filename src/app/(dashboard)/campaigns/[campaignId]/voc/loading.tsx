import { Skeleton, SkeletonFilterBar, SkeletonTable } from '@/components/ui/skeleton';

export default function VocLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-3.5 w-96" />
      <SkeletonFilterBar />
      <SkeletonTable rows={10} cols={8} />
    </div>
  );
}
