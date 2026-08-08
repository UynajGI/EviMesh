import { cn } from '@/lib/utils';

/*
 * Data primitives (M13.5-B07). Quiet surfaces: cards are flat with a hairline
 * border; badges are muted fills with readable foregrounds.
 */

/** Status or category label. Variants are token-based; default is muted. */
export function Badge({ variant = 'default', className, ...props }) {
  const variants = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
    info: 'bg-info/10 text-info',
  };
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variants[variant] ?? variants.default, className)} {...props} />;
}

/** Flat, hairline-bordered card surface. */
export function Card({ className, ...props }) {
  return <div className={cn('rounded-lg border border-border bg-card text-card-foreground', className)} {...props} />;
}

/** Card header: title + optional supporting text. */
export function CardHeader({ title, description, className }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 border-b border-border px-5 py-3.5', className)}>
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

/** Card body. */
export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

/** Label/value metadata row with tabular numerals for data. */
export function Metadata({ items, className }) {
  return (
    <dl className={cn('divide-y divide-border', className)}>
      {items.map((item) => (
        <div className="flex items-center justify-between gap-4 py-2" key={item.label}>
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="text-sm tabular-nums text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
