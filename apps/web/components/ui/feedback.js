import { CircleAlert, Inbox, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/*
 * Feedback primitives (M13.5-B06, M13.8 08 §1). Quiet by default: status
 * colors appear as a hairline border and an accent label, not as loud fills.
 * Blank-family states carry an icon circle (20px icon on a muted disc),
 * a 18px/600 title, a <=42ch description, and at least one next action.
 */

function BlankShell({ icon: Icon, tone, title, description, action, footer, role, className }) {
  const disc = tone === 'error'
    ? 'bg-status-danger-bg text-status-danger-fg'
    : tone === 'denied'
      ? 'bg-status-neutral-bg text-status-neutral-fg'
      : 'bg-muted text-muted-foreground';
  return (
    <div className={cn('rounded-lg border border-dashed border-border px-6 py-12 text-center', tone === 'error' && 'border-solid border-status-danger-border', className)} role={role}>
      {Icon ? (
        <span aria-hidden="true" className={cn('mx-auto grid size-10 place-items-center rounded-full', disc)}>
          <Icon size={20} />
        </span>
      ) : null}
      <p className="mt-3 text-lg font-semibold text-foreground">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-[42ch] text-sm text-muted-foreground">{description}</p> : null}
      {footer}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

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

/** Empty state with an optional action (design book 08 §1.1). */
export function Empty({ title, description, action, className }) {
  return (
    <BlankShell action={action} className={className} description={description} icon={Inbox} title={title} />
  );
}

/** Recoverable error state: icon disc, message, traceable request id, retry. */
export function ErrorState({ title = 'Something went wrong', message, requestId, onRetry, retryLabel = 'Try again', className }) {
  return (
    <BlankShell
      className={className}
      description={message}
      footer={requestId ? <p className="mx-auto mt-3 font-mono text-xs tabular-nums text-muted-foreground">request id: {requestId}</p> : null}
      icon={CircleAlert}
      role="alert"
      title={title}
      tone="error"
      action={onRetry ? (
        <button className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90" onClick={onRetry} type="button">
          {retryLabel}
        </button>
      ) : null}
    />
  );
}

/** Denied state (design book 08 §1.1): lock disc, missing scope, request path. */
export function DeniedState({ title = 'Permission needed', description, scope, action, actionLabel = 'Request access', onRequest, className }) {
  return (
    <BlankShell
      action={onRequest ? (
        <button className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90" onClick={onRequest} type="button">
          {actionLabel}
        </button>
      ) : action}
      className={className}
      description={description ?? 'This object is private. The missing permission or visibility level is explained below.'}
      footer={scope ? <p className="mx-auto mt-3 font-mono text-xs text-muted-foreground">missing scope: {scope}</p> : null}
      icon={Lock}
      title={title}
      tone="denied"
    />
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
