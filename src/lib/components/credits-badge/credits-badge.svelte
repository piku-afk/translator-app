<script lang="ts">
  import Coins from '@lucide/svelte/icons/coins';
  import Badge from '../ui/badge/badge.svelte';
  import Skeleton from '../ui/skeleton/skeleton.svelte';

  type Props = { loading: true } | { credits: string } | { error: string };

  let props: Props = $props();
  const isDestructive = $derived('error' in props);
  const formattedCredits = $derived(
    'credits' in props ? `${Number(props.credits).toFixed(2)}` : '0',
  );
</script>

<Badge color={isDestructive ? 'destructive' : undefined}>
  <Coins />
  {#if 'loading' in props}
    <Skeleton class="h-5 w-20" />
  {:else if 'error' in props}
    {props.error}
  {:else}
    {formattedCredits} Credits
  {/if}
</Badge>
