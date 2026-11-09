import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { ActorName } from '@/components/ui/doc';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/selection';
import { cn } from '@/lib/utils';

async function readEvents() {
  const base = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
  if (!base) return [];
  try {
    const response = await fetch(`${base}/events?limit=100`, { cache: 'no-store' });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body.items) ? body.items : [];
  } catch {
    return [];
  }
}

/* List events carry actor and object inside the signed payload. The human
 * publisher is named first; agents are never shown as the signer. */
function eventActor(event) {
  const payload = event.payload ?? {};
  return event.actorId ?? event.createdBy ?? event.signedBy ?? payload.publisher_actor_id ?? payload.signer_actor_id ?? payload.actor_id ?? null;
}

function eventObject(event) {
  const payload = event.payload ?? {};
  return event.objectId ?? event.claimId ?? event.questionId ?? event.projectId ?? payload.entity_id ?? payload.project_id ?? event.eventId;
}

function eventWords(event) {
  const payload = event.payload ?? {};
  const doc = payload.typed_document ?? {};
  const value = [doc.title, doc.statement, doc.name, payload.project_name].find((entry) => typeof entry === 'string' && entry.trim());
  return value?.trim() ?? null;
}

/* Same shape as shortId in components/ui/doc.js (a client module). */
function shortId(value) {
  if (!value) return '';
  const underscore = value.indexOf('_');
  const head = underscore > 0 ? value.slice(0, underscore + 7) : value.slice(0, 7);
  return value.length > head.length + 4 ? `${head}…${value.slice(-4)}` : value;
}

function readable(value) {
  return String(value ?? '').replaceAll('_', ' ');
}

export default async function ContributionsPage({ searchParams }) {
  const params = await searchParams;
  const role = params?.role ?? 'all';
  const objectType = params?.object ?? 'all';
  const events = (await readEvents())
    .filter((event) => role === 'all' || event.role === role)
    .filter((event) => objectType === 'all' || event.objectType === objectType)
    .sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0));

  return (
    <PageContainer wide>
      <PageHeader title="Contributions" titleClassName="sm:max-w-none sm:whitespace-nowrap" />
      <div className="doc-grid mt-8">
        <section aria-labelledby="contributions-heading" className="doc-main">
          <SectionHeader
            action={<span className="tabular-nums text-muted-foreground">{events.length}</span>}
            id="contributions-heading"
            title="Signed contribution events"
          />
          {events.length === 0 ? (
            <p className="border-b border-border py-5 text-sm font-medium">No matching events</p>
          ) : (
            <ul aria-label="Signed contribution events">
              {events.map((event) => {
                const actor = eventActor(event);
                return (
                  <li className="ref-row" key={event.eventId}>
                    <p className="text-sm text-muted-foreground">{readable(event.eventType ?? 'event').replace(/^governance\./, '').replaceAll('.', ' ')}</p>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-x-1.5 text-[0.9375rem]">
                        {actor ? <ActorName actorId={actor} showOwner={false} /> : <span className="text-muted-foreground">Actor not stated</span>}
                        <span className="text-muted-foreground">recorded</span>
                        {eventWords(event) ? <Link className="font-serif hover:underline" href={`/events?${event.objectType && event.objectId ? `objectType=${encodeURIComponent(event.objectType)}&objectId=${encodeURIComponent(event.objectId)}&` : ''}order=desc#event-${encodeURIComponent(event.eventId)}`}>{eventWords(event)}</Link> : <Link className="font-mono text-sm hover:text-primary hover:underline" href={`/events?${event.objectType && event.objectId ? `objectType=${encodeURIComponent(event.objectType)}&objectId=${encodeURIComponent(event.objectId)}&` : ''}order=desc#event-${encodeURIComponent(event.eventId)}`} title={eventObject(event)}>{shortId(eventObject(event))}</Link>}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {event.role ? <span>{readable(event.role)}</span> : null}
                        {event.objectType ?? event.payload?.entity_type ? <span>{readable(event.objectType ?? event.payload?.entity_type)}</span> : null}
                        {eventWords(event) ? <span className="font-mono" title={eventObject(event)}>{shortId(eventObject(event))}</span> : null}
                      </p>
                    </div>
                    <time className="text-xs tabular-nums text-muted-foreground md:text-right" dateTime={event.createdAt}>{event.createdAt ? `${new Date(event.createdAt).toISOString().replace('T', ' ').slice(0, 16)} UTC` : null}</time>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside aria-label="Filters" className="doc-margin">
          <section className="margin-section">
            <h2>Filter the record</h2>
            <form className="grid gap-4" method="get">
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="contrib-role">Role
                <Select defaultValue={role} id="contrib-role" name="role"><option value="all">All roles</option><option value="author">Author</option><option value="verifier">Verifier</option><option value="curator">Curator</option><option value="maintainer">Maintainer</option></Select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="contrib-object">Object
                <Select defaultValue={objectType} id="contrib-object" name="object"><option value="all">All objects</option><option value="question">Question</option><option value="answer">Answer</option><option value="claim">Claim</option><option value="evidence">Evidence</option><option value="dataset">Dataset</option><option value="tool">Tool</option></Select>
              </label>
              <button className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'justify-self-start')} type="submit">Apply filters</button>
            </form>
          </section>
          <section className="margin-section">
            <h2>Audit</h2>
            <Link className="text-sm text-primary hover:underline" href="/events">Event audit</Link>
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
