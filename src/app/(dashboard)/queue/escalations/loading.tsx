import {
  SkeletonHeader,
  SkeletonFilterBar,
  SkeletonTable,
} from '@/components/ui/skeleton';

export default function EscalationsLoading() {
  return (
    <div className="space-y-4">
      <SkeletonHeader />
      <SkeletonFilterBar />
      <SkeletonTable rows={10} cols={5} />
    </div>
  );
}
