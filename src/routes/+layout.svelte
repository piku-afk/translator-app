<script lang="ts">
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import Library from '@lucide/svelte/icons/library';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import NoteBookPen from '@lucide/svelte/icons/notebook-pen';
  import Settings from '@lucide/svelte/icons/settings';
  import '@fontsource-variable/geist/wght.css';
  import { invalidateAll } from '$app/navigation';
  import favicon from '$lib/assets/favicon.svg';
  import CreditsBadge from '$lib/components/credits-badge/credits-badge.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { getErrorMessage } from '$lib/utils';
  import '../app.css';
  import SidebarItem from '$lib/components/ui/sidebar/sidebar-item.svelte';
  import { page } from '$app/state';

  let { children, data } = $props();
  let isRefreshing = $state(false);
  const sidebarElements =
    page.url.pathname === '/'
      ? [{ label: 'Novels', href: '/novels', icon: Library }]
      : [
          { label: 'Overview', href: '/overview', icon: LayoutDashboard },
          { label: 'Chapters', href: '/chapters', icon: BookOpen },
          { label: 'Notes', href: '/notes', icon: NoteBookPen },
        ];

  async function refresh() {
    isRefreshing = true;
    await invalidateAll();
    isRefreshing = false;
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<header class="fixed top-0 left-0 bg-gray-100 border-b border-gray-300 py-4 px-6 w-full">
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

    <div class="ml-auto w-68 flex gap-4 *:grow *:shrink-0 *:max-w-1/2 justify-between items-center">
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

<main class="mt-16.75 mr-70 p-6 flex flex-col gap-4">
  {@render children()}
</main>

<aside
  class="fixed top-16.75 right-0 w-70 h-[calc(100vh-4.1875rem)] border-l border-gray-300 py-4 flex flex-col gap-4"
>
  <header class="px-5">
    <h2 class="text-lg font-medium">Home</h2>
  </header>

  <nav class="h-full flex flex-col gap-4">
    <ul class="px-2 flex flex-col gap-2">
      {#each sidebarElements as { label, href, icon }}
        <SidebarItem {label} {href} {icon} />
      {/each}
    </ul>

    <ul class="mt-auto border-t border-gray-300 pt-4 px-2">
      <SidebarItem label="Settings" href="/settings" icon={Settings} />
    </ul>
  </nav>
</aside>
