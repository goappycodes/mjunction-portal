import {
  SkeletonHeader,
  SkeletonFilterBar,
  SkeletonCardGrid,
} from '@/components/ui/skeleton';

export default function CampaignsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonFilterBar />
      <SkeletonCardGrid count={6} />
    </div>
  );
}
