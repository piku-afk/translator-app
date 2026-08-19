<script lang="ts">
  import type { SvelteHTMLElements } from 'svelte/elements';

  import { cn } from '$lib/utils.js';

  let { class: className, ...restProps }: SvelteHTMLElements['div'] = $props();
</script>

<div
  aria-hidden="true"
  class={cn('rounded-md bg-gray-300 animate-pulse', className)}
  {...restProps}
></div>
