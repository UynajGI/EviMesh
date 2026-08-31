import Link from 'next/link';
import { ArrowUpRight, Bot, History, Network } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/ui/page';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function readList(path) {
  if (!API) return [];
  try {
    const response = await fetch(`${API}${path}`, { cache: 'no-store' });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body) ? body : body.items ?? [];
  } catch {
    return [];
  }
}

function readable(value, fallback = 'not stated') {
  return String(value ?? fallback).replaceAll('_', ' ');
}

function dateLabel(value) {
  if (!value || Number.isNaN(Date.parse(value))) return 'date not stated';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
}

function TaskRow({ task, index }) {
  return <li className="grid min-w-0 grid-cols-12 gap-y-3 border-b border-border py-5"><span className="col-span-2 font-mono text-[10px] text-primary sm:col-span-1">{String(index + 1).padStart(2, '0')}</span><div className="col-span-10 min-w-0 sm:col-span-7"><p className="font-mono text-[10px] uppercase text-muted-foreground">{readable(task.state, 'open')} / {task.projectId ?? 'project not stated'}</p><Link className="mt-1 block font-serif text-xl leading-tight [overflow-wrap:anywhere] hover:text-primary" href={`/tasks/${task.taskId}`}>{task.title ?? task.taskId}</Link></div><div className="col-span-10 col-start-3 min-w-0 font-mono text-[10px] text-muted-foreground sm:col-span-4 sm:col-start-auto sm:text-right"><code className="[overflow-wrap:anywhere]">{task.taskId}</code><p className="mt-1">{dateLabel(task.createdAt)}</p></div></li>;
}

export default async function WorkPage() {
  const [tasks, claims, events] = await Promise.all([
    readList('/tasks?status=open&limit=12'),
    readList('/claims?status=under_verification&limit=8'),
    readList('/events?limit=12&order=desc'),
  ]);
  return (
    <PageContainer wide>
      <PageHeader
        action={<Link className="inline-flex min-h-11 items-center gap-2 border border-foreground px-4 font-mono text-[10px] font-bold uppercase text-primary hover:bg-foreground hover:text-background" href="/agent"><Bot aria-hidden="true" size={14} />Open Agent handoff</Link>}
        description="Read the current assignment, verification and event record. Research authoring continues through CLI or MCP."
        eyebrow="Work"
        title="The working record"
      />
      <section className="grid min-w-0 grid-cols-12 border-y border-foreground py-5"><p className="col-span-12 font-mono text-[10px] font-bold uppercase text-primary sm:col-span-2">DISPATCH</p><p className="col-span-12 mt-3 max-w-[64ch] font-serif text-lg leading-7 text-muted-foreground sm:col-span-7 sm:mt-0">Trace active work by stable object, date and state. The website remains a reading surface; local tools hold drafts and signatures.</p><Link className="col-span-12 mt-5 inline-flex min-h-11 items-center justify-between border-l border-foreground pl-4 font-mono text-[10px] font-bold uppercase text-primary sm:col-span-3 sm:mt-0" href="/docs"><span>Read operating docs</span><ArrowUpRight aria-hidden="true" size={14} /></Link></section>

      <div className="grid min-w-0 grid-cols-12 gap-y-12 py-12 lg:gap-x-8">
        <section className="col-span-12 min-w-0 lg:col-span-8" aria-labelledby="open-work-heading">
          <header className="flex items-end justify-between border-b border-foreground pb-3"><div><p className="font-mono text-[10px] font-bold uppercase text-primary">OPEN ASSIGNMENTS</p><h2 className="mt-2 font-serif text-4xl font-medium tracking-[-0.04em]" id="open-work-heading">Research ready to continue</h2></div><Link className="hidden font-mono text-[10px] font-bold uppercase text-primary sm:block" href="/tasks">All tasks →</Link></header>
          {tasks.length > 0 ? <ol className="m-0 list-none p-0">{tasks.map((task, index) => <TaskRow index={index} key={task.taskId} task={task} />)}</ol> : <p className="border-b border-border py-8 font-serif text-xl text-muted-foreground">No open assignments are visible in this view.</p>}
        </section>

        <aside className="col-span-12 min-w-0 border-t border-foreground pt-5 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-labelledby="verification-heading">
          <p className="font-mono text-[10px] font-bold uppercase text-primary">VERIFICATION</p><h2 className="mt-2 font-serif text-3xl font-medium tracking-[-0.035em]" id="verification-heading">Claims in review</h2>
          {claims.length > 0 ? <ol className="mt-5 m-0 list-none border-t border-border p-0">{claims.map((claim) => <li className="border-b border-border py-4" key={claim.claimId}><p className="font-mono text-[10px] uppercase text-muted-foreground">{readable(claim.state)}</p><Link className="mt-1 block font-serif text-lg leading-tight hover:text-primary" href={`/claims/${claim.claimId}`}>{claim.title ?? claim.statement ?? claim.claimId}</Link><code className="mt-2 block font-mono text-[9px] text-muted-foreground [overflow-wrap:anywhere]">{claim.claimId}</code></li>)}</ol> : <p className="mt-5 border-y border-border py-6 text-sm text-muted-foreground">No claims are visible in this review state.</p>}
          <Link className="mt-5 inline-flex min-h-11 w-full items-center justify-between border border-foreground px-4 font-mono text-[10px] font-bold uppercase text-primary" href="/verification"><span>Open verification record</span><Network aria-hidden="true" size={14} /></Link>
        </aside>
      </div>

      <section className="border-t border-foreground py-10" aria-labelledby="event-record-heading">
        <header className="grid min-w-0 grid-cols-12"><p className="col-span-12 font-mono text-[10px] font-bold uppercase text-primary sm:col-span-2">EVENT RECORD</p><h2 className="col-span-12 mt-2 font-serif text-4xl font-medium tracking-[-0.04em] sm:col-span-7 sm:mt-0" id="event-record-heading">Recent attributable changes</h2><Link className="col-span-12 mt-4 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-primary sm:col-span-3 sm:mt-0 sm:justify-end" href="/events"><History aria-hidden="true" size={14} />Full event audit</Link></header>
        {events.length > 0 ? <ol className="mt-6 m-0 list-none border-t border-foreground p-0">{events.map((event) => <li className="grid min-w-0 grid-cols-12 gap-y-2 border-b border-border py-4" key={event.eventId}><p className="col-span-12 font-mono text-[10px] font-bold uppercase text-primary sm:col-span-3">{readable(event.eventType, 'event')}</p><code className="col-span-12 min-w-0 font-mono text-[10px] [overflow-wrap:anywhere] sm:col-span-6">{event.eventId}</code><time className="col-span-12 font-mono text-[10px] text-muted-foreground sm:col-span-3 sm:text-right" dateTime={event.createdAt}>{dateLabel(event.createdAt)}</time></li>)}</ol> : <p className="mt-6 border-y border-border py-8 font-serif text-xl text-muted-foreground">No recent events are visible.</p>}
      </section>
    </PageContainer>
  );
}
