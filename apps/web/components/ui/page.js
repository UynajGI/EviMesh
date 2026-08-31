import { cn } from '@/lib/utils';

/*
 * Page templates (M13.5-B11). One container + header pattern covers list,
 * detail, workspace, wizard, and settings pages: eyebrow, title, description,
 * and an action slot, with a consistent vertical rhythm.
 */

export function PageContainer({ children, className, wide = false }) {
  return <main className={cn('mx-auto min-w-0 px-[var(--evimesh-container-px)] py-10 text-foreground sm:py-14', wide ? 'max-w-[96rem]' : 'max-w-[88rem]', className)}>{children}</main>;
}

export function PageHeader({ eyebrow, title, description, action, className }) {
  return (
    <header className={cn('grid min-w-0 grid-cols-12 gap-x-3 gap-y-5 border-b border-foreground pb-8 pt-4 sm:gap-x-5 sm:pb-10', className)}>
      {eyebrow ? <p className="col-span-12 min-w-0 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-primary sm:col-span-2">{eyebrow}</p> : <span className="hidden sm:col-span-2 sm:block" />}
      <div className="col-span-12 min-w-0 sm:col-span-7">
        <h1 className="max-w-[18ch] font-serif text-[clamp(2.75rem,6vw,6.5rem)] font-medium leading-[0.9] tracking-[-0.055em] [overflow-wrap:anywhere]">{title}</h1>
        {description ? <p className="mt-5 max-w-[48ch] font-serif text-base leading-7 text-muted-foreground sm:text-lg">{description}</p> : null}
      </div>
      {action ? <div className="col-span-12 min-w-0 border-t-2 border-primary pt-3 sm:col-span-3 sm:self-end">{action}</div> : null}
    </header>
  );
}

/** Section heading inside a page with an optional trailing action. */
export function SectionHeader({ title, action, className }) {
  return (
    <div className={cn('flex min-w-0 items-baseline justify-between gap-4 border-t border-foreground pt-4', className)}>
      <h2 className="min-w-0 font-serif text-2xl font-medium tracking-[-0.03em] [overflow-wrap:anywhere]">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
