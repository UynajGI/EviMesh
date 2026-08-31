import Link from 'next/link';
import { PageContainer, PageHeader } from '@/components/ui/page';

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

function eventActor(event) {
  return event.actorId ?? event.createdBy ?? event.signedBy ?? 'actor not stated';
}

function eventObject(event) {
  return event.objectId ?? event.claimId ?? event.questionId ?? event.projectId ?? event.eventId;
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
      <PageHeader
        description="Browse attributable public events by time, role and research object. Every row opens the signed record that produced it."
        eyebrow="Contribution Atlas"
        title="Work, in public context."
        titleClassName="sm:max-w-none sm:whitespace-nowrap"
      />
      <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,9fr)]">
        <aside className="min-w-0 border-b border-foreground pb-6 lg:border-r lg:border-b-0 lg:pr-8">
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">Filter the record</h2>
          <form className="mt-6 grid gap-5" method="get">
            <label className="grid gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Role<select className="min-h-11 border border-border bg-background px-3 font-sans text-sm normal-case tracking-normal text-foreground" defaultValue={role} name="role"><option value="all">All roles</option><option value="author">Author</option><option value="verifier">Verifier</option><option value="curator">Curator</option><option value="maintainer">Maintainer</option></select></label>
            <label className="grid gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Object<select className="min-h-11 border border-border bg-background px-3 font-sans text-sm normal-case tracking-normal text-foreground" defaultValue={objectType} name="object"><option value="all">All objects</option><option value="question">Question</option><option value="answer">Answer</option><option value="claim">Claim</option><option value="evidence">Evidence</option><option value="dataset">Dataset</option><option value="tool">Tool</option></select></label>
            <button className="min-h-11 border border-foreground px-3 font-mono text-[10px] font-bold uppercase text-primary hover:bg-foreground hover:text-background" type="submit">Apply filters</button>
          </form>
          <p className="mt-6 font-serif text-sm leading-6 text-muted-foreground">Filters change the visible chronology only.</p>
        </aside>
        <section aria-label="Signed contribution events" className="min-w-0">
          {events.length === 0 ? <div className="border-y border-foreground py-14"><p className="font-serif text-2xl font-medium">No public events match this scope.</p><p className="mt-3 text-sm text-muted-foreground">Try a broader role or object filter.</p></div> : <ol className="m-0 list-none p-0">{events.map((event) => <li className="grid min-w-0 gap-3 border-b border-border py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,7fr)] sm:gap-8" key={event.eventId}><time className="font-mono text-[10px] font-bold uppercase leading-5 text-primary" dateTime={event.createdAt}>{event.createdAt ? new Date(event.createdAt).toISOString().replace('T', ' ').slice(0, 16) : 'time not stated'}</time><div className="min-w-0"><span className="font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{String(event.eventType ?? 'event').replaceAll('_', ' ')}</span><h2 className="mt-2 font-serif text-xl font-medium tracking-[-0.02em] [overflow-wrap:anywhere]">{eventActor(event)} recorded {eventObject(event)}</h2><p className="mt-2 font-mono text-[10px] text-muted-foreground [overflow-wrap:anywhere]">event {event.eventId}</p><Link className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-primary hover:underline" href={`/events/${encodeURIComponent(event.eventId)}`}>Open signed event →</Link></div></li>)}</ol>}
        </section>
      </div>
    </PageContainer>
  );
}
