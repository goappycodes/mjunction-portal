import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';

export default function ReportsLoading() {
  return (
    <div className="space-y-4">
      <SkeletonCard lines={2} />
      <SkeletonTable rows={12} cols={8} />
    </div>
  );
}
