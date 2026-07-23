import {
  SkeletonHeader,
  SkeletonFilterBar,
  SkeletonTable,
} from '@/components/ui/skeleton';

export default function VocReportsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonFilterBar />
      <SkeletonTable rows={10} cols={8} />
    </div>
  );
}
