<script lang="ts">
  import Skeleton from '$lib/components/ui/skeleton/skeleton.svelte';
</script>

<ul class="space-y-3 skeleton-activity">
  {#each [1, 2, 3, 4, 5] as _}
    <li class="flex flex-col items-start gap-3">
      <Skeleton class="h-3 w-1/5" />
      <Skeleton class="h-2 w-1/10" />
    </li>
  {/each}
</ul>
