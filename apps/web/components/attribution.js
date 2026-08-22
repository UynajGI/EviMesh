import Link from 'next/link';
import { cn } from '@/lib/utils';

/*
 * Attribution chain (design book 10 / R10): the actor is always named, and an
 * agent's owning human is rendered as an explicit via link. This component
 * never infers ownership or upgrades self-declared identity strength.
 */
export function Attribution({ actorId, actorType = 'human', ownerActorId = null, label = 'by', className }) {
  if (!actorId) return <span className={cn('attr text-muted-foreground', className)}>attribution not stated</span>;
  const agent = actorType === 'agent' || actorType === 'service';
  const actorHref = agent ? `/agents/${encodeURIComponent(actorId)}` : `/people/${encodeURIComponent(actorId)}`;
  return (
    <span className={cn('attr inline-flex flex-wrap items-center gap-1', className)}>
      <span className="text-muted-foreground">{label}</span>
      <Link className="font-medium text-foreground hover:underline" href={actorHref}>{actorId}</Link>
      {agent && ownerActorId ? (
        <>
          <span aria-hidden="true" className="attr__via text-muted-foreground">via</span>
          <Link className="font-medium text-foreground hover:underline" href={`/people/${encodeURIComponent(ownerActorId)}`}>{ownerActorId}</Link>
        </>
      ) : null}
    </span>
  );
}
