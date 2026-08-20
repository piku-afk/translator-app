import { Skeleton } from './ui/skeleton';

export function RecentActivitySkeleton() {
  return (
    <ul className="space-y-3 skeleton-activity">
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="flex flex-col items-start gap-3">
          <Skeleton className="h-3 w-1/5" />
          <Skeleton className="h-2 w-1/10" />
        </li>
      ))}
    </ul>
  );
}