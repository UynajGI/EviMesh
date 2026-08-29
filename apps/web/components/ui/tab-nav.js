'use client';

import { cn } from '@/lib/utils';

/*
 * TabNav (11-revision-decisions.md §4.1): the single tab form for the whole
 * app - underline style per the design book tabs. Two modes:
 *  - controlled: items + active + onChange (client state)
 *  - link: items with href + active (URL-addressable views)
 * Counts are navigation entry points (tab-sized badge), never a score.
 * Touch targets are 44px (h-11); the strip scrolls horizontally when tabs
 * overflow on 390px.
 */
export function TabNav({ items, active, onChange, ariaLabel, className }) {
  const controlled = typeof onChange === 'function';
  return (
    <div className={cn('-mb-px flex gap-1 overflow-x-auto border-b border-border', className)} role="tablist" aria-label={ariaLabel}>
      {items.map((entry) => {
        const selected = entry.key === active;
        const inner = (
          <>
            {entry.label}
            {entry.count !== undefined && entry.count !== null ? (
              <span className="rounded-full border border-border bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">{entry.count}</span>
            ) : null}
          </>
        );
        const shell = cn(
          '-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          selected ? 'border-primary font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
        );
        if (!controlled && entry.href) {
          return (
            <a
              aria-current={selected ? 'page' : undefined}
              aria-selected={selected}
              className={shell}
              href={entry.href}
              key={entry.key}
              role="tab"
            >
              {inner}
            </a>
          );
        }
        return (
          <button
            aria-selected={selected}
            className={shell}
            key={entry.key}
            onClick={controlled ? () => onChange(entry.key) : undefined}
            role="tab"
            type="button"
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
