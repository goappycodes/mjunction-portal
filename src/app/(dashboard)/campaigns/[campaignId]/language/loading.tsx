import { Skeleton } from '@/components/ui/skeleton';

export default function LanguageLoading() {
  return (
    <div className="max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <Skeleton className="h-4 w-40" />
      <div className="mt-5 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-48" />
          </div>
        ))}
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
      <Skeleton className="mt-6 ml-auto h-9 w-40" />
    </div>
  );
}
