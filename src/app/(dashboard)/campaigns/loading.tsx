import {
  SkeletonHeader,
  SkeletonFilterBar,
  SkeletonTable,
} from '@/components/ui/skeleton';

export default function CampaignsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonFilterBar />
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
