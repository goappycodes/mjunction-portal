import { SkeletonHeader, SkeletonCard } from '@/components/ui/skeleton';

export default function ImportLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonCard lines={3} />
    </div>
  );
}
