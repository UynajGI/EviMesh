import { cn } from '@/lib/utils';

/*
 * Rail (11-revision-decisions.md §3): the single right-rail shape. Desktop
 * holds an 18rem sticky column; below `lg` the rail folds under the main
 * column and RailSections keep their own headings, so the caller decides
 * per-section whether the content still earns its place on mobile.
 */
export function Rail({ children, className, label }) {
  return (
    <aside aria-label={label} className={cn('w-full min-w-0 lg:sticky lg:top-20 lg:w-[18rem] lg:self-start', className)}>
      <div className="flex flex-col gap-6">{children}</div>
    </aside>
  );
}

export function RailSection({ title, children, className }) {
  return (
    <section className={cn('border-t border-border pt-4 first:border-t-0 first:pt-0', className)}>
      {title ? <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2> : null}
      <div className={cn('min-w-0', title && 'mt-3')}>{children}</div>
    </section>
  );
}

/** One bounded rail row: label + value or a link. Counts stay entry points. */
export function RailRow({ label, children, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1.5 text-sm', className)}>
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium tabular-nums text-foreground">{children}</span>
    </div>
  );
}
