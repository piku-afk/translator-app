<script lang="ts">
  import ErrorFallback from '$lib/components/error-fallback/error-fallback.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Skeleton from '$lib/components/ui/skeleton/skeleton.svelte';

  // Hardcoded novels data for the homepage prototype
  const novels = [
    {
      id: 1,
      title: 'The Beginning',
      languagePair: 'Korean → English',
      progress: 82,
      totalChapters: 120,
      currentChapter: 98,
      lastUpdated: '4 min ago',
      initial: 'T',
    },
    {
      id: 2,
      title: 'Another World',
      languagePair: 'Japanese → English',
      progress: 34,
      totalChapters: 62,
      currentChapter: 21,
      lastUpdated: 'yesterday',
      initial: 'A',
    },
    {
      id: 3,
      title: 'Midnight Shadows',
      languagePair: 'Korean → English',
      progress: 76,
      totalChapters: 95,
      currentChapter: 72,
      lastUpdated: '1 hour ago',
      initial: 'M',
    },
  ];

  // Hardcoded activity data for the homepage prototype
  const activity = [
    { text: 'Chapter 89 translated', time: '4 min ago', color: 'bg-primary' },
    { text: 'Chapter 88 approved', time: '8 min ago', color: 'bg-primary' },
    { text: 'Chapter 87 needs review', time: '12 min ago', color: 'bg-primary' },
    { text: 'Glossary updated', time: '18 min ago', color: 'bg-primary' },
    { text: 'Chapter 38 translated', time: '21 min ago', color: 'bg-primary' },
  ];
</script>

<main class="max-w-5xl w-full mx-auto py-6 flex flex-col gap-10">
  <!-- Greeting -->
  <div class="text-center">
    <h1 class="text-3xl font-semibold text-foreground">Good morning, Alex</h1>
    <p class="mt-2 text-muted-foreground">Continue where you left off</p>
  </div>

  <!-- Featured Novels -->
  <section class="space-y-8">
    <h2 class="text-xl font-medium text-foreground" aria-level="2">Your Novels</h2>

    <!-- Skeleton Loading State for Novels -->
    <div class="grid gap-4 grid-cols-3">
      {#each [1, 2, 3] as _}
        <article class="border border-gray-300 rounded-lg p-4">
          <div class="space-y-2 flex flex-col gap-1">
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-3  w-2/3" />
            <div class="flex justify-between">
              <Skeleton class="h-3 w-15" />
              <Skeleton class="h-3 w-25" />
            </div>
          </div>
        </article>
      {/each}
    </div>

    <!-- Error State for Novels -->
    <ErrorFallback
      componentName="Your Novels"
      error={Error('some error message')}
      onRetry={() => {}}
    />

    <!-- Actual Novel Cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each novels as novel}
        <article
          class="border rounded-md border-border p-4 hover:bg-card hover:border-black transition-colors cursor-pointer focus:outline-ring focus-visible:outline-2 focus-visible:outline-ring"
        >
          <div class="flex items-start gap-3">
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-medium text-foreground line-clamp-2">
                {novel.title}
              </h3>
              <p class="mt-1 text-sm text-muted-foreground line-clamp-1">
                {novel.languagePair}
              </p>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">Active</span>
            </div>
            <div class="text-right">
              <p class="text-sm font-medium text-foreground">
                {novel.currentChapter} / {novel.totalChapters} chapters
              </p>
              <p class="text-xs text-muted-foreground">{novel.lastUpdated}</p>
            </div>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <!-- Recent Activity -->
  <section class="space-y-6">
    <h2 class="text-xl font-medium text-foreground" aria-level="2">Recent Activity</h2>

    <!-- Skeleton Loading State for Activity -->
    <ul class="space-y-3 skeleton-activity">
      {#each [1, 2, 3, 4, 5] as _}
        <li class="flex flex-col items-start gap-3">
          <Skeleton class="h-3 w-1/5" />
          <Skeleton class="h-2 w-1/10" />
        </li>
      {/each}
    </ul>

    <!-- Error State for Activity -->
    <ErrorFallback
      componentName="Recent Activity"
      error={Error('some error message')}
      onRetry={() => {}}
    />

    <!-- Actual Activity Items -->
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
  </section>
</main>
