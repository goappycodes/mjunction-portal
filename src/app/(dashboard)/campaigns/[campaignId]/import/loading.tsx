import { SkeletonCard } from '@/components/ui/skeleton';

export default function ImportLoading() {
  return (
    <div className="space-y-4">
      <SkeletonCard lines={3} />
    </div>
  );
}
