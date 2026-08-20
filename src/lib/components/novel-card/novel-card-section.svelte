<script lang="ts">
  import ErrorFallback from '$lib/components/error-fallback/error-fallback.svelte';
  import NovelCard from './novel-card.svelte';
  import NovelCardSkeleton from './novel-card-skeleton.svelte';

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

  let {
    novels,
    loading = false,
    error = null,
    onRetry,
  }: {
    novels: Novel[];
    loading?: boolean;
    error?: unknown;
    onRetry?: () => void | Promise<void>;
  } = $props();
</script>

<section class="space-y-8">
  <h2 class="text-xl font-medium text-foreground" aria-level="2">Your Novels</h2>

  {#if loading}
    <!-- Skeleton Loading State for Novels -->
    <div class="grid gap-4 grid-cols-3">
      {#each [1, 2, 3] as _}
        <NovelCardSkeleton />
      {/each}
    </div>
  {:else if error}
    <!-- Error State for Novels -->
    <ErrorFallback
      componentName="Your Novels"
      {error}
      {onRetry}
    />
  {:else}
    <!-- Actual Novel Cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each novels as novel}
        <NovelCard {novel} />
      {/each}
    </div>
  {/if}
</section>
