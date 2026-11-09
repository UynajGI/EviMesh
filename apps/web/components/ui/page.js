import Link from 'next/link';
import { cn } from '@/lib/utils';

/*
 * Page templates. One container and one header shape serve list, workspace
 * and settings pages. The header is a plain line: the title at reading
 * scale and at most one action. No subtitle paragraph unless a page opts in;
 * the content explains itself.
 */

/* One page column for every surface, aligned with the shell header and footer
 * (.doc-page). `wide` is kept for callers but no longer widens. */
export function PageContainer({ children, className, wide = false }) {
  return <div className={cn('doc-page w-full min-w-0 pb-16 pt-6 text-foreground sm:pt-8', wide && 'is-wide', className)}>{children}</div>;
}

export function PageHeader({ title, description, action, className, titleClassName, showDescription = false }) {
  const titleColumnClass = action ? 'md:col-span-8' : 'md:col-span-12';
  const titleMaxClass = action ? 'max-w-[40ch]' : 'max-w-[56ch]';
  return (
    <header className={cn('grid min-w-0 grid-cols-12 items-center gap-x-6 gap-y-3 border-b border-border pb-4', className)}>
      <div className={cn('col-span-12 min-w-0', titleColumnClass)}>
        <h1 className={cn(titleMaxClass, 'text-balance text-[1.5rem] font-semibold leading-tight tracking-[-0.01em] [overflow-wrap:anywhere]', titleClassName)}>{title}</h1>
        {showDescription && description ? <p className="mt-1.5 max-w-[70ch] text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="col-span-12 flex min-w-0 md:col-span-4 md:justify-end">{action}</div> : null}
    </header>
  );
}

/** Section heading inside a page with an optional trailing action. */
export function SectionHeader({ title, action, className, id }) {
  return (
    <div className={cn('flex min-w-0 items-baseline justify-between gap-4 border-b border-border pb-1.5', className)}>
      <h2 className="min-w-0 text-[0.9375rem] font-semibold [overflow-wrap:anywhere]" id={id}>{title}</h2>
      {action ? <div className="shrink-0 text-sm">{action}</div> : null}
    </div>
  );
}

/** Breadcrumb line above a record head. */
export function Breadcrumb({ trail = [], className }) {
  if (trail.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4 text-[0.8125rem] text-muted-foreground', className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
        {trail.map((entry, index) => (
          <li className={cn('min-w-0 items-center gap-1.5', index === trail.length - 2 || trail.length === 1 ? 'flex' : 'hidden sm:flex')} key={`${entry.label}-${index}`}>
            {index > 0 ? <span aria-hidden="true" className="hidden text-border sm:inline">/</span> : null}
            {entry.href ? (
              <Link className="max-w-[40ch] truncate hover:text-foreground hover:underline" href={entry.href}>{entry.label}</Link>
            ) : (
              <span aria-current="page" className="truncate text-foreground">{entry.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
