import Link from 'next/link';
import { cn } from '@/lib/utils';

/*
 * Docs section navigation (docs-plan.md §4.2): the left column lists the IA
 * sections and their pages. Selection marks position only - never progress,
 * popularity, or rank. Desktop sticky; mobile it stays at the top of the
 * article and scrolls horizontally.
 */
export function DocsNav({ sections, activeSlug }) {
  return (
    <nav aria-label="Docs sections" className="min-w-0">
      {sections.map((section) => (
        <section aria-labelledby={`docs-nav-${section.id}`} className="mb-6 border-t border-border pt-3 first:border-t-0 first:pt-0" key={section.id}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" id={`docs-nav-${section.id}`}>{section.title}</h2>
          <ul className="mt-2 grid gap-0.5 list-none">
            {section.pages.map((page) => {
              const active = page.slug === activeSlug;
              return (
                <li key={page.slug}>
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block truncate rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted hover:text-foreground',
                      active ? 'bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground',
                    )}
                    href={`/docs/${page.slug}`}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

/** Right column: the page's own headings plus its provenance line. */
export function DocsToc({ toc, sourceOfTruth, updatedAt }) {
  if (toc.length === 0 && !sourceOfTruth) return null;
  return (
    <nav aria-label="On this page" className="min-w-0">
      {toc.length > 0 ? (
        <section className="mb-6 border-t border-border pt-3 first:border-t-0 first:pt-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this page</h2>
          <ul className="mt-2 grid gap-0.5 list-none">
            {toc.map((entry) => (
              <li className={entry.level === 3 ? 'pl-3' : ''} key={entry.slug}>
                <a className="block truncate rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" href={`#${entry.slug}`}>{entry.text}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {sourceOfTruth ? (
        <section className="border-t border-border pt-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source of truth</h2>
          <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{sourceOfTruth}</p>
          {updatedAt ? <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">updated {updatedAt}</p> : null}
        </section>
      ) : null}
    </nav>
  );
}
