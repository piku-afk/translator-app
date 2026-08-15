<script lang="ts">
  import { cva, type VariantProps } from 'class-variance-authority';
  import { cn } from '$lib/utils';

  const badgeVariants = cva('rounded-md flex items-center [&>svg]:mr-2', {
    variants: {
      variant: {
        default: 'border border-gray-300 bg-white',
        outline: 'border border-gray-300 bg-white ',
      },
      size: {
        default: 'py-1.25 px-3 text-sm',
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
  });

  type BadgeProps = VariantProps<typeof badgeVariants> & {
    class?: string;
  };

  let {
    variant = 'default',
    size = 'default',
    color = 'default',
    class: className,
    children,
    ...restProps
  }: BadgeProps & {
    children?: import('svelte').Snippet;
  } = $props();
</script>

<span class={cn(badgeVariants({ variant, size, color }), className)} {...restProps}>
  {@render children?.()}
</span>
