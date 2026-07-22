import {
  SkeletonHeader,
  SkeletonFilterBar,
  SkeletonStats,
  SkeletonChartCard,
} from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonFilterBar />
      <SkeletonStats count={6} />
      <SkeletonStats count={3} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonChartCard />
        <SkeletonChartCard />
      </div>
    </div>
  );
}
