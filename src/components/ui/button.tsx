import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '#/lib/utils';
import { Spinner } from './spinner';

const buttonVariants = cva(
  "rounded-md border border-transparent bg-clip-padding text-sm font-medium flex justify-center items-center gap-2 whitespace-nowrap active:not-aria-[haspopup]:translate-y-px [&_svg:not([class*='size-'])]:size-4 transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'border border-gray-300 bg-white hover:bg-gray-100',
        destructive:
          'border border-destructive bg-destructive/5 text-destructive hover:bg-destructive/10 focus-visible:border-destructive/40 focus-visible:ring-destructive/20',
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

type ButtonVariantProps = VariantProps<typeof buttonVariants> & {
  href?: string;
  loading?: boolean;
  loadingText?: string;
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {}

export function Button({
  variant = 'default',
  size = 'default',
  href,
  type = 'button',
  loading = false,
  loadingText = '',
  disabled,
  className,
  children,
  ...restProps
}: ButtonProps) {
  const cls = cn(buttonVariants({ variant, size }), className);

  if (href) {
    return (
      <a
        className={cls}
        href={disabled ? undefined : href}
        aria-disabled={disabled}
        role={disabled ? 'link' : undefined}
        tabIndex={disabled ? -1 : undefined}
      >
        {loading ? (
          <>
            <Spinner />
            {loadingText}
          </>
        ) : (
          children
        )}
      </a>
    );
  }

  return (
    <button
      className={cls}
      disabled={loading || disabled}
      aria-busy={loading}
      type={type}
      {...restProps}
    >
      {loading ? (
        <>
          <Spinner />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}