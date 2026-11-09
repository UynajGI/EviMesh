import { cn } from '@/lib/utils';

/*
 * Feedback primitives. A short note inside the page, not a tile: one line
 * saying what is missing or wrong, and the next action. Error and denied
 * states keep their request id or missing scope for traceability.
 */

function BlankShell({ tone, title, description, action, footer, role, className }) {
  const rule = tone === 'error'
    ? 'border-status-danger-border'
    : tone === 'denied'
      ? 'border-foreground/40'
      : 'border-border';
  return (
    <div className={cn('blank border-y py-5', rule, tone === 'error' && 'blank--error', tone === 'denied' && 'blank--denied', className)} role={role}>
      <p className={cn('text-sm font-medium', tone === 'error' ? 'text-status-danger-fg' : 'text-foreground')}>{title}</p>
      {description && tone ? <p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {footer}
      {action ? <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">{action}</div> : null}
    </div>
  );
}

const alertStyles = {
  info: 'border-status-info-border bg-status-info-bg text-status-info-fg',
  success: 'border-status-success-border bg-status-success-bg text-status-success-fg',
  warning: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
  destructive: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg',
};

/** Status banner: title + optional description, variant-coded by tier. */
export function Alert({ variant = 'info', title, description, className, ...props }) {
  return (
    <div className={cn('alert rounded-[2px] border px-4 py-3', `alert--${variant}`, alertStyles[variant] ?? alertStyles.info, className)} role="alert" {...props}>
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="mt-1 text-sm leading-6 opacity-90">{description}</p> : null}
    </div>
  );
}

/** Empty state: one line and an optional action. The description is kept
 * for callers but not shown; an empty list does not need a paragraph. */
export function Empty({ title, description, action, className }) {
  return (
    <BlankShell action={action} className={className} description={description} title={title} />
  );
}

/** Recoverable error state: icon disc, message, traceable request id, retry. */
export function ErrorState({ title = 'Something went wrong', message, requestId, onRetry, retryLabel = 'Try again', className }) {
  return (
    <BlankShell
      className={className}
      description={message}
      footer={requestId ? <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">request id: {requestId}</p> : null}
      role="alert"
      title={title}
      tone="error"
      action={onRetry ? (
        <button className="inline-flex h-9 items-center rounded-[2px] bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90" onClick={onRetry} type="button">
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
        <button className="inline-flex h-9 items-center rounded-[2px] bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90" onClick={onRequest} type="button">
          {actionLabel}
        </button>
      ) : action}
      className={className}
      description={description ?? 'This object is private. The missing permission or visibility level is explained below.'}
      footer={scope ? <p className="mt-2 font-mono text-xs text-muted-foreground">missing scope: {scope}</p> : null}
      title={title}
      tone="denied"
    />
  );
}

/** Skeleton block; combine widths for a loading layout. */
export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn("skeleton animate-pulse rounded-[2px] bg-muted", className)} />;
}
