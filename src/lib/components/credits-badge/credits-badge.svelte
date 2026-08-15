<script lang="ts">
  import Coins from '@lucide/svelte/icons/coins';
  import Badge from '../ui/badge/badge.svelte';
  import Skeleton from '../ui/skeleton/skeleton.svelte';

  type Props = { loading: true } | { credits: string } | { error: string };

  let props: Props = $props();
</script>

{#if 'loading' in props}
  <Badge>
    <Coins class="size-4" />
    <Skeleton class="h-5 w-20" />
  </Badge>
{:else if 'error' in props}
  <Badge color="destructive">
    <Coins class="size-4" />
    {props.error}
  </Badge>
{:else}
  <Badge>
    <Coins class="size-4" />
    {Number(props.credits).toFixed(2)} credits
  </Badge>
{/if}
