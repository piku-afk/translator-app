<script lang="ts">
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import '@fontsource-variable/geist/wght.css';
  import { invalidateAll } from '$app/navigation';
  import favicon from '$lib/assets/favicon.svg';
  import CreditsBadge from '$lib/components/credits-badge/credits-badge.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { getErrorMessage } from '$lib/utils';
  import '../app.css';

  let { children, data } = $props();
  let isRefreshing = $state(false);

  async function refresh() {
    isRefreshing = true;
    await invalidateAll();
    isRefreshing = false;
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<header class="fixed bg-gray-100 border-b border-gray-300 py-4 px-6 w-full">
  <nav aria-label="main navigation" class="flex items-baseline">
    <div class="flex items-baseline gap-6">
      <a href="/" class="text-2xl font-semibold leading-none"> Translator</a>

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

    <div class="ml-auto flex gap-4">
      <Button loading={isRefreshing} onclick={refresh}>
        <RotateCw />
        Refresh
      </Button>

      {#await data.credits}
        <CreditsBadge loading={true} />
      {:then credits}
        <CreditsBadge credits={credits.balance} />
      {:catch error}
        <CreditsBadge error={getErrorMessage(error)} />
      {/await}
    </div>
  </nav>
</header>
<main class="pt-16.25">
  {@render children()}
</main>
