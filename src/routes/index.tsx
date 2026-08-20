import { createFileRoute } from '@tanstack/react-router'
import { Greeting } from '../components/greeting'
import { NovelCard } from '../components/novel-card'
import { NovelCardSkeleton } from '../components/novel-card-skeleton'
import { RecentActivitySkeleton } from '../components/recent-activity-skeleton'
import { ErrorFallback } from '../components/error-fallback'
import { useFetchData } from '../lib/use-fetch-data'
import type { ActivityItem, Novel } from '../lib/mock-data'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const fetchNovelsJson = async (): Promise<Novel[]> => {
  const res = await fetch('/api/novels');
  if (!res.ok) throw new Error(`Failed to load novels`);
  return (await res.json()) as Novel[];
};

const fetchActivityJson = async (): Promise<ActivityItem[]> => {
  const res = await fetch('/api/activity');
  if (!res.ok) throw new Error('Failed to load activity');
  return (await res.json()) as ActivityItem[];
};

function HomePage() {
  const novels = useFetchData(fetchNovelsJson);
  const activity = useFetchData(fetchActivityJson);

  return (
    <main className="w-full py-6 flex flex-col gap-10">
      {/* Greeting */}
      <Greeting name="Alex" />

      {/* Featured Novels */}
      <section className="space-y-8">
        <h2 className="text-xl font-medium text-foreground" aria-level={2}>
          Your Novels
        </h2>

        {novels.status === 'loading' ? (
          <div className="grid gap-4 grid-cols-3">
            {[1, 2, 3].map((i) => (
              <NovelCardSkeleton key={i} />
            ))}
          </div>
        ) : novels.status === 'error' ? (
          <ErrorFallback componentName="Your Novels" error={novels.error} onRetry={novels.retry} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {novels.data.map((novel) => (
              <NovelCard key={novel.id} novel={novel} />
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section className="space-y-6">
        <h2 className="text-xl font-medium text-foreground" aria-level={2}>
          Recent Activity
        </h2>

        {activity.status === 'loading' ? (
          <RecentActivitySkeleton />
        ) : activity.status === 'error' ? (
          <ErrorFallback componentName="Recent Activity" error={activity.error} onRetry={activity.retry} />
        ) : (
          <ul className="space-y-3">
            {activity.data.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.text}</p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}