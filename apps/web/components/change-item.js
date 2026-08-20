'use client';

import Link from 'next/link';
import { Clock, FlaskConical, Mountain, OctagonAlert, ShieldQuestion } from 'lucide-react';
import { IdChip } from '@/components/ui/idchip';
import { cn } from '@/lib/utils';

/*
 * Change item (design book 05 §2): one event in the awareness stream. Level
 * first (icon + tone), then what happened, why it matters, and the basis
 * link. Levels express attention priority, never a verdict.
 */
const LEVELS = {
  critical: { icon: OctagonAlert, ring: 'border border-status-danger-border bg-status-danger-bg text-status-danger-fg', label: 'critical' },
  attention: { icon: ShieldQuestion, ring: 'bg-status-warning-bg text-status-warning-fg', label: 'attention' },
  update: { icon: FlaskConical, ring: 'bg-status-info-bg text-status-info-fg', label: 'update' },
  frontier: { icon: Mountain, ring: 'bg-status-accent-bg text-status-accent-fg', label: 'update' },
  task: { icon: Clock, ring: 'bg-status-neutral-bg text-status-neutral-fg', label: 'update' },
};

export function ChangeItem({ level = 'update', what, why, time, href, id, idLabel, meta, className }) {
  const { icon: Icon, ring } = LEVELS[level] ?? LEVELS.update;
  return (
    <article className={cn('grid grid-cols-[2rem_minmax(0,1fr)] gap-3 px-5 py-4', className)}>
      <span aria-hidden="true" className={cn('mt-0.5 grid size-8 place-items-center rounded-full', ring)}>
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="font-medium leading-snug">
          {href ? <Link className="hover:underline" href={href}>{what}</Link> : what}
        </p>
        {why ? <p className="mt-0.5 text-sm text-muted-foreground">{why}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {id ? <IdChip label={idLabel} value={id} /> : null}
          {meta}
          {time ? <span className="ml-auto text-xs tabular-nums text-muted-foreground">{time}</span> : null}
        </div>
      </div>
    </article>
  );
}

/* Group count badge tone follows the group level (mockup: critical 2 in
 * emphasis-danger, attention in warning, update in info). */
const COUNT_VARIANTS = {
  critical: 'border-transparent bg-emphasis-danger text-emphasis-foreground',
  attention: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
  update: 'border-status-info-border bg-status-info-bg text-status-info-fg',
  frontier: 'border-status-accent-border bg-status-accent-bg text-status-accent-fg',
  task: 'border-border bg-muted text-muted-foreground',
};

/** Stream group header with a level-tinted count badge, per the mockup sectionheads. */
export function ChangeGroup({ title, meta, count, level = 'update', children }) {
  return (
    <section className="mt-10" aria-labelledby={title.replace(/[^a-z0-9]+/gi, '-')}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight" id={title.replace(/[^a-z0-9]+/gi, '-')}>
          {title}
          {typeof count === 'number' ? (
            <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums', COUNT_VARIANTS[level] ?? COUNT_VARIANTS.update)}>{count}</span>
          ) : null}
        </h2>
        {meta ? <span className="text-sm text-muted-foreground">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}
