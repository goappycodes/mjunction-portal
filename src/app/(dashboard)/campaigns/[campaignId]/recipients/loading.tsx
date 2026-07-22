import { SkeletonFilterBar, SkeletonTable } from '@/components/ui/skeleton';

export default function RecipientsLoading() {
  return (
    <div className="space-y-4">
      <SkeletonFilterBar />
      <SkeletonTable rows={12} cols={6} />
    </div>
  );
}
