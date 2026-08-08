import { cn } from '@/lib/utils';

/* Text input (M13.5-B04): token-based with explicit focus and invalid states. */
const baseField =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-[invalid=true]:border-destructive';

export function Input({ className, type = 'text', ...props }) {
  return <input className={cn(baseField, 'h-10', className)} type={type} {...props} />;
}
