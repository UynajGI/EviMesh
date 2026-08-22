import Link from 'next/link';
import { cn } from '@/lib/utils';

export function actorHref(actorId, actorType = null) {
  const encoded = encodeURIComponent(actorId);
  if (actorType === 'agent' || actorType === 'service') return `/agents/${encoded}`;
  if (actorType === 'human') return `/people/${encoded}`;
  /* Unknown, organization, maintainer, and witness actors stay on the
   * type-neutral legacy route until their directory row is hydrated. */
  return `/contributors/${encoded}`;
}

/*
 * Attribution chain (design book 10 / R10): the actor is always named, and an
 * agent's owning human is rendered as an explicit via link. This component
 * never infers ownership or upgrades self-declared identity strength.
 */
export function Attribution({ actorId, actorType = null, ownerActorId = null, label = 'by', className }) {
  if (!actorId) return <span className={cn('attr text-muted-foreground', className)}>attribution not stated</span>;
  const agent = actorType === 'agent' || actorType === 'service';
  const href = actorHref(actorId, actorType);
  return (
    <span className={cn('attr inline-flex flex-wrap items-center gap-1', className)}>
      <span className="text-muted-foreground">{label}</span>
      <Link className="font-medium text-foreground hover:underline" href={href}>{actorId}</Link>
      {agent && ownerActorId ? (
        <>
          <span aria-hidden="true" className="attr__via text-muted-foreground">via</span>
          <Link className="font-medium text-foreground hover:underline" href={`/people/${encodeURIComponent(ownerActorId)}`}>{ownerActorId}</Link>
        </>
      ) : null}
    </span>
  );
}
