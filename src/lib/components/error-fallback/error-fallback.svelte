<script lang="ts">
  import { getErrorMessage } from '$lib/utils';
  import Button from '../ui/button/button.svelte';

  interface Props {
    componentName: string;
    error: unknown;
    onRetry?: () => void | Promise<void>;
  }

  const { componentName, error, onRetry }: Props = $props();
  const errorMessage = $derived(getErrorMessage(error));
</script>

<div
  role="alert"
  aria-live="polite"
  class="w-full py-6 rounded-lg border border-destructive flex flex-col gap-1 items-center text-center"
>
  <h3 class="text-lg">Failed to load {componentName}</h3>
  <p class="text-sm text-muted-foreground">{errorMessage}</p>

  {#if onRetry}
    <Button variant="destructive" class="mt-4" onclick={onRetry}>Try Again</Button>
  {/if}
</div>
