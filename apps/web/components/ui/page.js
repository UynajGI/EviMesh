import { cn } from '@/lib/utils';

/*
 * Page templates (M13.5-B11). One container + header pattern covers list,
 * detail, workspace, wizard, and settings pages: eyebrow, title, description,
 * and an action slot, with a consistent vertical rhythm.
 */

export function PageContainer({ children, className, wide = false }) {
  return <main className={cn('mx-auto px-6 py-14 text-foreground', wide ? 'max-w-7xl' : 'max-w-6xl', className)}>{children}</main>;
}

export function PageHeader({ eyebrow, title, description, action, className }) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow ? <p className="text-sm font-medium uppercase tracking-[0.16em] text-secondary-foreground">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/** Section heading inside a page with an optional trailing action. */
export function SectionHeader({ title, action, className }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
