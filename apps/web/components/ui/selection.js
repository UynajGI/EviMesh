import { cn } from '@/lib/utils';

/*
 * Selection primitives (M13.5-B05). All controls are native elements (or a
 * switch button with a Switch role), so keyboard operation and accessibility
 * semantics come from the platform rather than re-implemented focus traps.
 */

const controlAccent =
  'h-4 w-4 shrink-0 rounded border border-border bg-card text-primary transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-[invalid=true]:border-destructive';

export function Checkbox({ className, ...props }) {
  return <input className={cn(controlAccent, 'accent-primary', className)} type="checkbox" {...props} />;
}

export function Radio({ className, ...props }) {
  return <input className={cn(controlAccent, 'accent-primary', className)} type="radio" {...props} />;
}

/** Styled native select: keyboard and screen-reader support are native. */
export function Select({ className, children, ...props }) {
  return (
    <select className={cn('h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50', className)} {...props}>
      {children}
    </select>
  );
}

/** Toggle switch: a button with the Switch role, toggled with Space/Enter. */
export function Switch({ className, checked = false, onCheckedChange, disabled = false, ...props }) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-primary bg-primary' : 'border-border bg-muted',
        className,
      )}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      role="switch"
      type="button"
      {...props}
    >
      <span className={cn('inline-block size-4 translate-x-0.5 rounded-full bg-background transition-transform', checked && 'translate-x-[22px]')} />
    </button>
  );
}
