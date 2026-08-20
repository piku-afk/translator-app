<script lang="ts">
  import Skeleton from '$lib/components/ui/skeleton/skeleton.svelte';
</script>

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

