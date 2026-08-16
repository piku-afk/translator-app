<script lang="ts">
  import clsx from 'clsx';
  import { twMerge } from 'tailwind-merge';
  import type { LucideIcon } from '@lucide/svelte';

  interface SidebarItemProps {
    label: string;
    href: string;
    selected?: boolean;
    icon?: LucideIcon;
  }

  let { label, href, selected, icon: Icon }: SidebarItemProps = $props();
</script>

<li
  class={twMerge(
    clsx(
      "w-full py-2 px-3 border-none bg-transparent text-gray-500 font-normal text-sm rounded-md hover:text-black hover:bg-white hover:font-medium flex items-center gap-2 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      selected && 'text-black bg-white font-medium',
    ),
  )}
>
  <Icon />
  <a {href}> {label} </a>
</li>
