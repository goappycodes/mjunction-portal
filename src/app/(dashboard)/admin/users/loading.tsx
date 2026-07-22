import {
  SkeletonHeader,
  SkeletonCard,
  SkeletonFilterBar,
  SkeletonTable,
} from '@/components/ui/skeleton';

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonCard lines={2} />
      <SkeletonFilterBar />
      <SkeletonTable rows={6} cols={3} />
    </div>
  );
}
