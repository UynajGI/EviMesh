import { cn } from '@/lib/utils';

/*
 * Feedback primitives (M13.5-B06). Quiet by default: status colors appear as
 * a hairline border and an accent label, not as loud fills.
 */

const alertStyles = {
  info: 'border-info text-info',
  success: 'border-success text-success',
  warning: 'border-warning text-warning',
  destructive: 'border-destructive text-destructive',
};

/** Status banner: title + optional description, variant-coded by border/label. */
export function Alert({ variant = 'info', title, description, className, ...props }) {
  return (
    <div className={cn('rounded-md border bg-card px-4 py-3', alertStyles[variant] ?? alertStyles.info, className)} role="alert" {...props}>
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

/** Empty state with an optional action. */
export function Empty({ title, description, action, className }) {
  return (
    <div className={cn('rounded-md border border-dashed border-border px-6 py-12 text-center', className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Recoverable error state: message + retry action. */
export function ErrorState({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again', className }) {
  return (
    <div className={cn('rounded-md border border-destructive/40 bg-card px-6 py-8 text-center', className)} role="alert">
      <p className="text-sm font-medium text-destructive">{title}</p>
      {message ? <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p> : null}
      {onRetry ? (
        <button className="mt-4 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90" onClick={onRetry} type="button">
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Linear progress with an accessible role. */
export function Progress({ value = 0, max = 100, className }) {
  const clamped = Math.max(0, Math.min(max, value));
  const percentage = max === 0 ? 0 : Math.round((clamped / max) * 100);
  return (
    <div aria-label="Progress" aria-valuemax={max} aria-valuemin={0} aria-valuenow={clamped} className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)} role="progressbar">
      <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percentage}%` }} />
    </div>
  );
}

/** Skeleton block; combine widths for a loading layout. */
export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded bg-muted', className)} />;
}
