'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { actorHref } from '@/components/attribution';
import { cn } from '@/lib/utils';
import { shortId } from '@/lib/short-id.mjs';

/*
 * Research record primitives. A research object opens on its own words and
 * one byline of identity, then sections on hairlines, with a margin ledger
 * for history. Classes live in app/globals.css (.title-block, .clause ...).
 */

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const actorCache = new Map();

/** Public identity card for an actor id, cached per page session. */
export function useActorCard(actorId) {
  const [card, setCard] = useState(() => (actorId ? actorCache.get(actorId)?.value ?? null : null));
  useEffect(() => {
    if (!actorId || !API) return undefined;
    let cancelled = false;
    let entry = actorCache.get(actorId);
    if (!entry) {
      entry = { value: null, promise: fetch(`${API}/actors/${encodeURIComponent(actorId)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => { const value = body?.actor ?? null; entry.value = value; return value; })
        .catch(() => null) };
      actorCache.set(actorId, entry);
    }
    entry.promise.then((value) => { if (!cancelled) setCard(value); });
    return () => { cancelled = true; };
  }, [actorId]);
  return card;
}

export { shortId };

/**
 * One actor, named. Agents carry a robot glyph and their owning human; a
 * person carries the person glyph. Never upgrades self-declared identity.
 */
export function ActorName({ actorId, showOwner = true, className, quiet = false }) {
  const card = useActorCard(actorId);
  const owner = useActorCard(showOwner && card?.actorType === 'agent' ? card.ownerActorId : null);
  if (!actorId) return <span className={cn('text-muted-foreground', className)}>not stated</span>;
  const agent = card?.actorType === 'agent' || card?.actorType === 'service' || actorId.startsWith('agent_');
  const name = card?.displayName ?? shortId(actorId);
  return (
    <span className={cn('inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5', className)}>
      <Link className={cn('inline-flex min-w-0 items-center gap-1 font-medium hover:underline', quiet ? 'text-foreground' : 'text-foreground')} href={actorHref(actorId, card?.actorType ?? (agent ? 'agent' : null))} title={actorId}>
        {agent ? <Bot aria-label="Agent" className="shrink-0 self-center text-muted-foreground" size={13} /> : null}
        <span className="truncate">{name}</span>
      </Link>
      {agent && showOwner && card?.ownerActorId ? (
        <span className="text-muted-foreground">for <Link className="text-foreground hover:underline" href={actorHref(card.ownerActorId, 'human')} title={card.ownerActorId}>{owner?.displayName ?? shortId(card.ownerActorId)}</Link></span>
      ) : null}
    </span>
  );
}

/** Stable identifier with copy; always the full value on hover and copy. */
export function Identifier({ value, revision, className }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const full = revision ? `${value}@${revision}` : value;
  return (
    <button
      className={cn('inline-flex max-w-full items-baseline gap-1 text-left font-mono text-[0.75rem] text-muted-foreground hover:text-primary', className)}
      onClick={async () => { try { await navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* clipboard unavailable */ } }}
      title={`${full} (copy)`}
      type="button"
    >
      <span className="truncate">{shortId(value)}{revision ? <span className="text-muted-foreground">@{revision}</span> : null}</span>
      {copied ? <span aria-live="polite" className="shrink-0 font-sans text-xs text-muted-foreground">copied</span> : null}
    </button>
  );
}

/**
 * Record head: the object's own words, then one byline. Kind and State lead
 * the byline, followed by `cells` ([{ label, value }]) in reading order. A
 * cell with `bare` renders its value without a label. Nothing sits above
 * the title. `columns` is accepted for older callers and ignored.
 */
export function TitleBlock({ kind, title: titleProp, statement, serif = true, status, cells = [], actions, notice, titleClassName, className }) {
  const title = titleProp ?? statement;
  const identity = [
    { label: 'Kind', bare: true, value: <span className="font-medium text-foreground">{kind}</span> },
    ...(status ? [{ label: 'State', bare: true, value: status }] : []),
    ...cells.filter((cell) => cell.value !== null && cell.value !== undefined && cell.value !== false),
  ];
  return (
    <section aria-label={`${kind} identity`} className={cn('title-block', className)}>
      <div className="title-block__head">
        <h1 className={cn('max-w-[40ch] text-pretty [overflow-wrap:anywhere]', serif ? 'claim-statement font-serif text-[clamp(1.5rem,2.4vw,2rem)] font-medium leading-[1.22] tracking-[-0.01em]' : 'text-[1.5rem] font-semibold leading-tight tracking-[-0.01em]', titleClassName)}>{title}</h1>
        {notice}
      </div>
      <dl className="title-block__cells">
        {identity.map((cell) => (
          <div className="title-block__cell" key={cell.label}>
            <dt className={cell.bare ? 'sr-only' : undefined}>{cell.label}</dt>
            <dd>{cell.value}</dd>
          </div>
        ))}
      </dl>
      {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}

/** A citable section of the document. */
export function Clause({ id, number, title, aside, children, wide = false, className }) {
  return (
    <section aria-labelledby={`${id}-heading`} className={cn('clause', wide && 'clause--wide', className)} id={id}>
      <div className="clause__head">
        <h2 data-number={number} id={`${id}-heading`}>{title}</h2>
        <div className="flex items-baseline gap-3 text-sm text-muted-foreground">
          {aside}
          <a aria-label={`Link to ${title}`} className="clause__anchor" href={`#${id}`}>#</a>
        </div>
      </div>
      <div className="clause__body">{children}</div>
    </section>
  );
}

/** Inline index of section anchors, with the section in view marked. */
export function ClauseRail({ clauses }) {
  const [active, setActive] = useState(clauses[0]?.id ?? null);
  const idKey = clauses.map((clause) => clause.id).join('|');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const targets = idKey.split('|').map((id) => document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-80px 0px -65% 0px' });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [idKey]);
  return (
    <nav aria-label="Sections" className="clause-rail">
      {clauses.map((clause) => (
        <a aria-current={active === clause.id ? 'true' : undefined} href={`#${clause.id}`} key={clause.id}>
          {clause.label}{clause.count ? <span className="clause-rail__count">{clause.count}</span> : null}
        </a>
      ))}
    </nav>
  );
}

export function MarginSection({ title, children, className }) {
  return (
    <section className={cn('margin-section', className)}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** Plain list of protocol strings set as reading prose. */
export function ProseList({ items, empty = 'None stated.' }) {
  const values = (Array.isArray(items) ? items : items ? [items] : []).filter((item) => item !== null && item !== undefined && item !== '');
  if (values.length === 0) return <p className="clause__none">{empty}</p>;
  return <ul className="doc-list">{values.map((item, index) => <li key={index}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>)}</ul>;
}

export function formatDate(value) {
  if (!value) return null;
  const stamp = Date.parse(value);
  if (Number.isNaN(stamp)) return null;
  return new Date(stamp).toISOString().slice(0, 10);
}

export function formatDateTime(value) {
  if (!value) return null;
  const stamp = Date.parse(value);
  if (Number.isNaN(stamp)) return null;
  const iso = new Date(stamp).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
