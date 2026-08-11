import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/*
 * Action primitives (M13.5-B03). Every variant is built from semantic tokens
 * (verified by test/token-contrast.test.mjs); loading and disabled states are
 * explicit, and the focus ring uses the --evimesh-focus token.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-card text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: { default: 'h-10 px-4 py-2', sm: 'h-9 rounded-md px-3', lg: 'h-11 rounded-md px-8' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

/** Variants for `next/link` anchors styled as buttons. */
const buttonLinkVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-card text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: { default: 'h-10 px-4 py-2', sm: 'h-9 rounded-md px-3', lg: 'h-11 rounded-md px-8' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function LoadingDot() {
  return <span aria-hidden="true" className="inline-block size-2 animate-pulse rounded-full bg-current" />;
}

export function Button({ className, variant, size, loading = false, type = 'button', children, ...props }) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={loading || props.disabled} type={type} aria-busy={loading || undefined} {...props}>
      {loading ? <LoadingDot /> : null}
      {children}
    </button>
  );
}

export { buttonVariants, buttonLinkVariants };
