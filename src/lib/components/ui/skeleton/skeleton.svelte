<script lang="ts">
  import type { SvelteHTMLElements } from 'svelte/elements';

  import { cn } from '$lib/utils.js';

  let { class: className, ...restProps }: SvelteHTMLElements['div'] = $props();
</script>

<div class={cn('rounded-md bg-gray-100 animate-pulse', className)} {...restProps}></div>
