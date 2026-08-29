import Link from 'next/link';
import { cn } from '@/lib/utils';

/*
 * ObjectHeader (11-revision-decisions.md §3): one header shape for protocol
 * objects (claim, question, attempt, project). Order is fixed: badge row,
 * identity line, statement/title, attribution line, action slot.
 * At most one primary action per object page (04 §4.1); the caller owns the
 * choice, and this component only lays out the slot.
 *
 * `statement` renders in the scoped serif reading voice (03 §5) when
 * `serif` is true; titles otherwise stay sans. Never pass marketing copy as
 * a statement - the serif voice is for protocol prose only.
 */
export function ObjectHeader({
  badges = null,
  identity = null,
  statement = null,
  title = null,
  serif = false,
  attribution = null,
  meta = null,
  actions = null,
  className,
}) {
  return (
    <header className={cn('min-w-0', className)}>
      {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
      {identity ? <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{identity}</div> : null}
      {statement ? (
        <p
          className={cn(
            'mt-3 max-w-[65ch] text-lg leading-[1.7] text-foreground',
            serif && 'claim-statement font-serif text-[1.125rem]',
          )}
        >
          {statement}
        </p>
      ) : null}
      {title && !statement ? (
        <h1 className={cn('mt-3 text-3xl font-semibold tracking-tight text-foreground', serif && 'font-serif font-normal')}>{title}</h1>
      ) : null}
      {attribution ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{attribution}</div>
      ) : null}
      {meta ? <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">{meta}</div> : null}
      {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Breadcrumb row for object pages (Explore / <type> / <id>), keyboard navigable. */
export function ObjectBreadcrumb({ trail = [] }) {
  if (trail.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5 list-none">
        {trail.map((entry, index) => (
          <li className="flex items-center gap-1.5" key={`${entry.label}-${index}`}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {entry.href ? (
              <Link className="hover:text-foreground hover:underline" href={entry.href}>{entry.label}</Link>
            ) : (
              <span aria-current="page">{entry.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
