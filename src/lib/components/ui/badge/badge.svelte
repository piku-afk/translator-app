<script lang="ts">
  import { cva, type VariantProps } from 'class-variance-authority';
  import { cn } from '$lib/utils';
  import type { SvelteHTMLElements } from 'svelte/elements';

  const badgeVariants = cva(
    "rounded-md flex items-center gap-2 select-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    {
      variants: {
        variant: {
          default: 'border border-gray-300 bg-white',
          outline: 'border border-gray-300 bg-white ',
        },
        size: {
          default: 'py-1.25 px-3 text-sm font-medium',
        },
        color: {
          default: '',
          destructive: 'border-[#e7000b] text-[#e7000b]',
        },
      },
      defaultVariants: {
        size: 'default',
        color: 'default',
        variant: 'default',
      },
    },
  );

  type BadgeProps = SvelteHTMLElements['span'] & VariantProps<typeof badgeVariants>;

  let {
    variant = 'default',
    size = 'default',
    color = 'default',
    class: className,
    children,
    ...restProps
  }: BadgeProps = $props();
</script>

<span class={cn(badgeVariants({ variant, size, color }), className)} {...restProps}>
  {@render children?.()}
</span>
