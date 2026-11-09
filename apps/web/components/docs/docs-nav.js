import Link from 'next/link';
import { cn } from '@/lib/utils';

/*
 * Docs section navigation (docs-plan.md §4.2): the left column lists the IA
 * sections and their pages. Selection marks reading position only. Desktop
 * sticky; mobile it stays at the top of the
 * article and scrolls horizontally.
 */
export function DocsNav({ sections, activeSlug }) {
  return (
    <nav aria-label="Docs sections" className="min-w-0">
      {sections.map((section) => (
        <section aria-labelledby={`docs-nav-${section.id}`} className="mb-6 border-t border-border pt-3 first:border-t-0 first:pt-0" key={section.id}>
          <h2 className="text-sm font-semibold text-foreground" id={`docs-nav-${section.id}`}>{section.title}</h2>
          <ul className="mt-2 grid gap-0.5 list-none">
            {section.pages.map((page) => {
              const active = page.slug === activeSlug;
              return (
                <li key={page.slug}>
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block truncate border-l-2 py-1.5 pl-2.5 pr-2 text-sm transition-colors hover:text-foreground',
                      active ? 'border-foreground font-medium text-foreground' : 'border-transparent text-muted-foreground',
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
          <h2 className="text-sm font-semibold text-foreground">On this page</h2>
          <ul className="mt-2 grid gap-0.5 list-none">
            {toc.map((entry) => (
              <li className={entry.level === 3 ? 'pl-3' : ''} key={entry.slug}>
                <a className="block truncate py-1 text-sm text-muted-foreground hover:text-foreground hover:underline" href={`#${entry.slug}`}>{entry.text}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {sourceOfTruth ? (
        <section className="border-t border-border pt-3">
          <h2 className="text-sm font-semibold text-foreground">Source of truth</h2>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{sourceOfTruth}</p>
          {updatedAt ? <p className="mt-1 text-xs tabular-nums text-muted-foreground">Updated {updatedAt}</p> : null}
        </section>
      ) : null}
    </nav>
  );
}
