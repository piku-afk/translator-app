<script lang="ts">
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import type { gateway } from 'ai';
  import { getErrorMessage } from '$lib/utils';
  import CreditsBadge from '../credits-badge/credits-badge.svelte';
  import Button from '../ui/button/button.svelte';

  interface HeaderProps {
    credits: ReturnType<(typeof gateway)['getCredits']>;
    isRefreshing: boolean;
    refresh: () => Promise<void>;
  }

  const { credits, isRefreshing, refresh }: HeaderProps = $props();
</script>

<header class="fixed z-10 top-0 left-0 bg-gray-100 border-b border-gray-300 py-4 px-6 w-full">
  <nav aria-label="main navigation" class="flex items-baseline">
    <div class="flex items-baseline gap-6">
      <a href="/" class="text-2xl font-normal leading-none"> Translator</a>

      <ul class="flex items-baseline">
        <li>
          <a
            href="/projects"
            class="text-lg font-light leading-none text-gray-500 hover:text-black"
          >
            Projects</a
          >
        </li>
      </ul>
    </div>

    <div class="ml-auto max-w-70 flex gap-4 justify-between items-center">
      <Button loading={isRefreshing} loadingText="Refreshing" onclick={refresh}>
        <RotateCw />
        Refresh
      </Button>

      {#await credits}
        <CreditsBadge loading={true} />
      {:then credits}
        <CreditsBadge credits={credits.balance} />
      {:catch error}
        <CreditsBadge error={getErrorMessage(error)} />
      {/await}
    </div>
  </nav>
</header>
