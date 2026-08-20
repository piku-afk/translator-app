import { Skeleton } from './ui/skeleton';

export function NovelCardSkeleton() {
  return (
    <article className="border border-gray-300 rounded-lg p-4">
      <div className="space-y-2 flex flex-col gap-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3  w-2/3" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-15" />
          <Skeleton className="h-3 w-25" />
        </div>
      </div>
    </article>
  );
}