import { SkeletonFilterBar, SkeletonTable } from '@/components/ui/skeleton';

export default function DispatchLoading() {
  return (
    <div className="space-y-6">
      <SkeletonFilterBar />
      <SkeletonTable rows={5} cols={5} />
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}
