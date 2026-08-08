import { cn } from '@/lib/utils';

/* Text form primitives (M13.5-B04): token-based, composable, accessible. */

const baseField =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-[invalid=true]:border-destructive';

export function Input({ className, type = 'text', ...props }) {
  return <input className={cn(baseField, 'h-10', className)} type={type} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(baseField, 'min-h-24 resize-y', className)} {...props} />;
}

export function Label({ className, ...props }) {
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}

/** Helper text under a field. */
export function Help({ className, ...props }) {
  return <p className={cn('text-xs text-muted-foreground', className)} {...props} />;
}

/** Field-level error; pair with the field id via aria-describedby. */
export function Error({ className, ...props }) {
  return <p className={cn('text-sm text-destructive', className)} {...props} />;
}

/** Vertical field group: label, control, help/error. */
export function FieldGroup({ label, htmlFor, help, error, children, className }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {error ? <Error id={error.id ?? `${htmlFor}-error`}>{error.message}</Error> : help ? <Help id={`${htmlFor}-help`}>{help}</Help> : null}
    </div>
  );
}
