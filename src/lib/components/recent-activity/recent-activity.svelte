<script lang="ts">
  import ErrorFallback from '$lib/components/error-fallback/error-fallback.svelte';
  import RecentActivitySkeleton from './recent-activity-skeleton.svelte';

  interface ActivityItem {
    text: string;
    time: string;
    color: string;
  }

  let {
    activity,
    loading = false,
    error = null,
    onRetry,
  }: {
    activity: ActivityItem[];
    loading?: boolean;
    error?: unknown;
    onRetry?: () => void | Promise<void>;
  } = $props();
</script>

<section class="space-y-6">
  <h2 class="text-xl font-medium text-foreground" aria-level="2">Recent Activity</h2>

  {#if loading}
    <RecentActivitySkeleton />
  {:else if error}
    <ErrorFallback
      componentName="Recent Activity"
      {error}
      {onRetry}
    />
  {:else}
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
  {/if}
</section>
