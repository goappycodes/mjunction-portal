import {
  SkeletonHeader,
  SkeletonFilterBar,
  SkeletonTable,
} from '@/components/ui/skeleton';

export default function RecipientsHubLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonFilterBar />
      <SkeletonTable rows={12} cols={6} />
    </div>
  );
}
