<script lang="ts">
  import ErrorFallback from '$lib/components/error-fallback/error-fallback.svelte';
  import Greeting from '$lib/components/greeting/greeting.svelte';
  import NovelCardSkeleton from '$lib/components/novel-card/novel-card-skeleton.svelte';
  import NovelCard from '$lib/components/novel-card/novel-card.svelte';
  import RecentActivitySkeleton from '$lib/components/recent-activity/recent-activity-skeleton.svelte';

  interface Novel {
    id: number;
    title: string;
    languagePair: string;
    progress: number;
    totalChapters: number;
    currentChapter: number;
    lastUpdated: string;
    initial: string;
  }

  interface ActivityItem {
    text: string;
    time: string;
    color: string;
  }

  let { data } = $props();
  let retryNovelsPromise = $state<Promise<Novel[]> | null>(null);
  let retryRecentActivityPromise = $state<Promise<ActivityItem[]> | null>(null);
  const novels = $derived(retryNovelsPromise ?? data.novels);
  const activity = $derived(retryRecentActivityPromise ?? data.activity);

  async function retryNovels() {
    retryNovelsPromise = fetch('/api/novels').then(async (res) => {
      if (!res.ok) throw new Error(res.statusText);
      return (await res.json()) satisfies Novel[];
    });
  }

  async function retryRecentActivity() {
    retryRecentActivityPromise = fetch('/api/activity').then(async (res) => {
      if (!res.ok) throw new Error('Failed to load activity');
      return (await res.json()) satisfies ActivityItem[];
    });
  }
</script>

<main class="max-w-5xl w-full mx-auto py-6 flex flex-col gap-10">
  <!-- Greeting -->
  <Greeting name="Alex" />

  <!-- Featured Novels -->
  <section class="space-y-8">
    <h2 class="text-xl font-medium text-foreground" aria-level="2">Your Novels</h2>

    {#await novels}
      <div class="grid gap-4 grid-cols-3">
        {#each [1, 2, 3] as _}
          <NovelCardSkeleton />
        {/each}
      </div>
    {:then novels}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each novels as novel}
          <NovelCard {novel} />
        {/each}
      </div>
    {:catch error}
      <ErrorFallback componentName="Your Novels" {error} onRetry={retryNovels} />
    {/await}
  </section>

  <!-- Recent Activity -->
  <section class="space-y-6">
    <h2 class="text-xl font-medium text-foreground" aria-level="2">Recent Activity</h2>

    {#await activity}
      <RecentActivitySkeleton />
    {:then activity}
      <ul class="space-y-3">
        {#each activity as item}
          <li class="flex items-start gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-foreground">{item.text}</p>
              <p class="text-xs text-muted-foreground">{item.time}</p>
            </div>
          </li>
        {/each}
      </ul>
    {:catch error}
      <ErrorFallback componentName="Recent Activity" {error} onRetry={retryRecentActivity} />
    {/await}
  </section>
</main>
