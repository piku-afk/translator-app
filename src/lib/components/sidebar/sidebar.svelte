<script>
  import Library from '@lucide/svelte/icons/library';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import NoteBookPen from '@lucide/svelte/icons/notebook-pen';
  import Settings from '@lucide/svelte/icons/settings';
  import { page } from '$app/state';
  import SidebarItem from './sidebar-item.svelte';

  const sidebarElements =
    page.url.pathname === '/'
      ? [{ label: 'Novels', href: '/novels', icon: Library }]
      : [
          { label: 'Overview', href: '/overview', icon: LayoutDashboard },
          { label: 'Chapters', href: '/chapters', icon: BookOpen },
          { label: 'Notes', href: '/notes', icon: NoteBookPen },
        ];
</script>

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
