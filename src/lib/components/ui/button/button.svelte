<script lang="ts" module>
  import { cva, type VariantProps } from 'class-variance-authority';
  import { cn } from '$lib/utils.js';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
  import Spinner from '../spinner/spinner.svelte';

  export const buttonVariants = cva(
    "rounded-md border border-transparent bg-clip-padding text-sm font-medium flex justify-center items-center active:not-aria-[haspopup]:translate-y-px [&_svg:not([class*='size-'])]:size-4 transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    {
      variants: {
        variant: {
          default: 'border border-gray-300 bg-white hover:bg-gray-100',
        },
        size: {
          default: 'py-1.5 px-3 text-sm',
        },
      },
      defaultVariants: {
        variant: 'default',
        size: 'default',
      },
    },
  );

  type ButtonProps = HTMLButtonAttributes &
    HTMLAnchorAttributes &
    VariantProps<typeof buttonVariants> & { loading?: boolean };
</script>

<script lang="ts">
  let {
    variant = 'default',
    size = 'default',
    href = undefined,
    type = 'button',
    loading = false,
    disabled,
    children,
    class: className,
    ...restProps
  }: ButtonProps = $props();
</script>

{#if href}
  <a
    class={cn(buttonVariants({ variant, size }), className)}
    href={disabled ? undefined : href}
    aria-disabled={disabled}
    role={disabled ? 'link' : undefined}
    tabindex={disabled ? -1 : undefined}
    {...restProps}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    class={cn(buttonVariants({ variant, size }), className)}
    disabled={loading || disabled}
    aria-busy={loading}
    {type}
    {...restProps}
  >
    {#if loading}
      <span aria-hidden="true" class="">
        <Spinner />
      </span>
    {:else}
      <span class="inline-flex gap-2 shrink-0 items-center justify-center whitespace-nowrap">
        {@render children?.()}
      </span>
    {/if}
  </button>
{/if}
