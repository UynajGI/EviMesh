import { cn } from '@/lib/utils';

/*
 * Data primitives (M13.5-B07, extended in M13.8). Quiet surfaces: cards are
 * flat with a hairline border. Badges come in three tiers:
 *   - legacy tint variants (kept for existing call sites)
 *   - dual-tier status variants: token bg/fg/border pairs (design book 02)
 *   - emphasis variants: solid, reserved for the most consequential state per view
 * Status text always leads; color is never the only carrier.
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
    /* M13.8 dual tiers */
    'status-neutral': 'border border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg',
    'status-accent': 'border border-status-accent-border bg-status-accent-bg text-status-accent-fg',
    'status-success': 'border border-status-success-border bg-status-success-bg text-status-success-fg',
    'status-warning': 'border border-status-warning-border bg-status-warning-bg text-status-warning-fg',
    'status-danger': 'border border-status-danger-border bg-status-danger-bg text-status-danger-fg',
    'status-info': 'border border-status-info-border bg-status-info-bg text-status-info-fg',
    /* M13.8 emphasis (solid) */
    'emphasis-success': 'bg-emphasis-success text-emphasis-foreground',
    'emphasis-warning': 'bg-emphasis-warning text-emphasis-foreground',
    'emphasis-danger': 'bg-emphasis-danger text-emphasis-foreground',
    'emphasis-info': 'bg-emphasis-info text-emphasis-foreground',
    'emphasis-neutral': 'bg-emphasis-neutral text-emphasis-foreground',
  };
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variants[variant] ?? variants.default, className)} {...props} />;
}

/*
 * Protocol state -> badge variant (design book 02 protocol semantic map).
 * Counts and states are entry points, never scores.
 */
const STATUS_VARIANTS = {
  /* Claim lifecycle */
  hypothesis: 'status-neutral',
  candidate: 'status-info',
  under_verification: 'status-accent',
  provisionally_accepted: 'status-success',
  accepted: 'status-success',
  contested: 'status-warning',
  refuted: 'emphasis-danger',
  superseded: 'status-neutral',
  retracted: 'status-danger',
  dependency_tainted: 'status-warning',
  /* Question lifecycle */
  proposal: 'status-neutral',
  review: 'status-neutral',
  admissibility: 'status-neutral',
  active_question: 'status-success',
  resolution: 'status-accent',
  archived: 'status-neutral',
  rejected: 'status-neutral',
  /* Task lifecycle */
  open: 'status-neutral',
  leased: 'status-accent',
  blocked: 'status-warning',
  completed: 'status-success',
  cancelled: 'status-neutral',
  /* Challenge lifecycle */
  admissible: 'status-info',
  investigating: 'status-accent',
  upheld: 'emphasis-danger',
  resolved: 'status-success',
  /* Evidence relation to a claim revision */
  supports: 'status-success',
  refutes: 'status-danger',
  qualifies: 'status-warning',
  reproduces: 'status-info',
  /* Watchlist change levels (attention priority, never truth) */
  critical: 'emphasis-danger',
  attention: 'status-warning',
  update: 'status-info',
  quiet: 'status-neutral',
};

export function resolveStatusVariant(state) {
  return STATUS_VARIANTS[state] ?? 'status-neutral';
}

/** Protocol status badge with a human-readable, text-first label. */
export function StatusBadge({ state, label, className }) {
  return (
    <Badge className={className} variant={resolveStatusVariant(state)}>
      {(label ?? state ?? '').replaceAll('_', ' ')}
    </Badge>
  );
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
