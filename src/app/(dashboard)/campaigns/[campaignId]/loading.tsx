import { SkeletonStats, SkeletonChartCard } from '@/components/ui/skeleton';

export default function CampaignOverviewLoading() {
  return (
    <div className="space-y-6">
      <SkeletonStats count={6} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonChartCard />
        <SkeletonChartCard />
      </div>
    </div>
  );
}
