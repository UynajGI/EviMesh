'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, StatusBadge } from '@/components/ui/data';
import { HandoffSheet } from '@/components/handoff-sheet';
import { Alert, Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Check, Eye, Flag, FlaskConical, History, Mountain, Share2 } from 'lucide-react';
import { IdChip } from '@/components/ui/idchip';
import { hydrateEvidenceLinks, hydrateReceiptFindings, evidenceRelations } from '@/lib/hydrate';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

const VIEWS = [
  { id: 'summary', label: 'Summary' },
  { id: 'frontier', label: 'Current frontier' },
  { id: 'argument', label: 'Argument' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'verification', label: 'Verification & challenges' },
  { id: 'activity', label: 'Activity' },
];

const RELATIONS = ['supports', 'refutes', 'qualifies', 'reproduces'];
const ATTENTION_STATES = new Set(['contested', 'refuted', 'retracted', 'dependency_tainted']);

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? 'Question data is unavailable.');
  return body;
}

function relativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

/*
 * Research workspace (M13.8 05-core-ui-spec.md §5): one question, six
 * URL-independent protocol views. Claims form a DAG, never a tree; counts are
 * entry points, never scores.
 */
export default function QuestionDetailPage({ params }) {
  const [questionId, setQuestionId] = useState(null);
  const [view, setView] = useState('summary');
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [watched, setWatched] = useState(false);
  const [shared, setShared] = useState(false);
  const [previousSnapshot, setPreviousSnapshot] = useState(null);
  const [sharedRev, setSharedRev] = useState(null);
  const [data, setData] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { Promise.resolve(params).then(({ questionId: value }) => setQuestionId(value)); }, [params]);

  /* Question-wide views must see every claim: follow the claim list cursor
   * (capped defensively at five pages) instead of stopping at one page. */
  async function fetchAllClaims(projectId) {
    const items = [];
    let cursor = null;
    for (let page = 0; page < 5; page += 1) {
      const body = await request(`/claims?projectId=${projectId}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      items.push(...(body.items ?? []));
      if (!body.nextCursor) break;
      cursor = body.nextCursor;
    }
    return items;
  }

  async function load() {
    setError(null);
    try {
      const question = await request(`/questions/${questionId}`);
      const projectId = question.question.projectId;
      const [taskItems, frontier, claimItems, events] = await Promise.all([
        request(`/tasks?projectId=${projectId}&limit=100`).then((body) => body.items ?? []),
        request(`/projects/${projectId}/frontier/latest`).then((body) => body.frontier ?? null).catch(() => null),
        fetchAllClaims(projectId).catch(() => []),
        request(`/events?objectType=question&objectId=${questionId}&limit=20`).then((body) => body.items ?? []).catch(() => []),
      ]);
      // Tasks and claims are queried per project; keep only this question's.
      const tasks = taskItems.filter((task) => task.questionId === questionId);
      const claims = claimItems.filter((claim) => claim.questionId === questionId);
      // frontier/latest does not hydrate members; the paged history does.
      let frontierWithMembers = frontier;
      if (frontier?.snapshotId) {
        /* History is ascending and paginated: traverse to the final page
         * (bounded) so the latest snapshot and its predecessor are present. */
        const history = [];
        let historyCursor = null;
        for (let page = 0; page < 10; page += 1) {
          const body = await request(`/projects/${projectId}/frontier/history?limit=100${historyCursor ? `&cursor=${encodeURIComponent(historyCursor)}` : ''}`).catch(() => null);
          if (!body) break;
          history.push(...(body.items ?? []));
          if (!body.nextCursor) break;
          historyCursor = body.nextCursor;
        }
        const match = history.find((snapshot) => snapshot.snapshotId === frontier.snapshotId);
        frontierWithMembers = match ? { ...frontier, members: match.members } : frontier;
        const sorted = [...history].sort((left, right) => (right.sequence ?? 0) - (left.sequence ?? 0));
        const currentIndex = sorted.findIndex((snapshot) => snapshot.snapshotId === frontier.snapshotId);
        if (currentIndex >= 0 && sorted[currentIndex + 1]) setPreviousSnapshot(sorted[currentIndex + 1]);
      }
      setData({ ...question, tasks, frontier: frontierWithMembers, claims, events });
    } catch (reason) {
      setError(reason.message);
    }
  }

  useEffect(() => { if (questionId) load(); }, [questionId]);
  /* Immutable share context: ?rev=N pins the question revision in the URL. */
  useEffect(() => {
    const rev = new URLSearchParams(window.location.search).get('rev');
    if (rev) setSharedRev(Number.parseInt(rev, 10));
  }, []);
  useEffect(() => {
    try { setWatched(localStorage.getItem(`evimesh-watch-${questionId}`) === '1'); } catch { /* unavailable */ }
  }, [questionId]);

  /* Evidence and receipts load lazily, once, on their first tab view.
   * They cover every claim of this question (up to the list ceiling of 100). */
  const claimIds = (data?.claims ?? []).map((claim) => claim.claimId);
  useEffect(() => {
    if (view !== 'evidence' || evidence !== null || !data) return;
    setEvidence('loading');
    Promise.all(claimIds.map((id) => request(`/evidence?claimId=${id}&limit=100`).then((body) => body.items ?? []).catch(() => [])))
      .then((groups) => hydrateEvidenceLinks(API, groups.flat()))
      .then(setEvidence)
      .catch(() => setEvidence([]));
  }, [view, data, evidence, claimIds.join(',')]);

  useEffect(() => {
    if (view !== 'verification' || receipts !== null || !data) return;
    setReceipts('loading');
    Promise.all(claimIds.map((id) => request(`/claims/${id}/verifications`).then((body) => body.items ?? body.receipts ?? []).catch(() => [])))
      .then((groups) => hydrateReceiptFindings(API, groups.flat()))
      .then(setReceipts)
      .catch(() => setReceipts([]));
  }, [view, data, receipts, claimIds.join(',')]);

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>;

  const { question, currentRevision, contract, tasks, frontier, claims, events } = data;
  /* Scope fields live on the contract revision (research_contract_revisions),
   * not the question revision; read both with the contract winning. */
  const scopeSource = { ...currentRevision, ...Object.fromEntries(
    Object.entries(contract ?? {}).filter(([key]) => ['scope', 'exclusions', 'falsification', 'acceptance'].includes(key)),
  ) };
  const attentionClaims = claims.filter((claim) => ATTENTION_STATES.has(claim.state));
  const frontierMembers = Array.isArray(frontier?.members) ? frontier.members : [];

  const evidenceByRelation = (relation) => (evidence ?? []).filter((item) => evidenceRelations(item).includes(relation));
  const outcomeCount = (outcome) => (receipts ?? []).filter((receipt) => receipt.outcome === outcome).length;
  const topFindingSeverity = (receipts ?? []).reduce((top, receipt) => {
    for (const finding of receipt.findings ?? []) {
      if (finding.severity === 'critical') return 'critical';
      if (finding.severity === 'major' && top !== 'critical') top = 'major';
      else if (finding.severity === 'warning' && !top) top = 'warning';
    }
    return top;
  }, null);

  return (
    <PageContainer wide>
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/explore">Explore</Link>
        <span aria-hidden="true">/</span>
        <Link className="tabular-nums hover:text-foreground" href={`/projects/${question.projectId}`}>{question.projectId}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="max-w-[40ch] truncate">{currentRevision.title ?? question.questionId}</span>
      </nav>

      <PageHeader
        action={(
          <div className="flex flex-wrap gap-2">
            <button
              aria-pressed={watched}
              className={cn('inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium', watched ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:bg-muted')}
              onClick={() => {
                const next = !watched;
                setWatched(next);
                try {
                  if (next) localStorage.setItem(`evimesh-watch-${questionId}`, '1');
                  else localStorage.removeItem(`evimesh-watch-${questionId}`);
                } catch { /* unavailable */ }
              }}
              type="button"
            >
              <Eye aria-hidden="true" size={14} />
              {watched ? 'Watching' : 'Watch'}
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
              onClick={async () => {
                try {
                  const shareContext = new URL(window.location.href);
                  shareContext.searchParams.set('rev', String(currentRevision.revision ?? 1));
                  await navigator.clipboard.writeText(shareContext.href);
                  setShared(true);
                  setTimeout(() => setShared(false), 2000);
                } catch { /* unavailable */ }
              }}
              type="button"
            >
              {shared ? <Check aria-hidden="true" size={14} /> : <Share2 aria-hidden="true" size={14} />}
              {shared ? 'Link copied' : 'Share this snapshot'}
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-accent-foreground/90" onClick={() => setHandoffOpen(true)} type="button">Continue with an agent</button>
          </div>
        )}
        description={currentRevision.statement}
        eyebrow={`Question · r${sharedRev ?? currentRevision.revision ?? 1}`}
        title={currentRevision.title}
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <StatusBadge state={question.state} />
        <IdChip label="question" value={question.questionId} />
        {frontier ? <span className="text-xs tabular-nums text-muted-foreground">Frontier #{frontier.sequence}</span> : null}
        {currentRevision.createdAt ? (
          <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <History aria-hidden="true" size={12} />
            created {new Date(currentRevision.createdAt).toISOString().slice(0, 10)}
          </span>
        ) : null}
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Workspace views">
        {VIEWS.map((entry) => (
          <button
            aria-selected={view === entry.id}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              view === entry.id ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            key={entry.id}
            onClick={() => setView(entry.id)}
            role="tab"
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>

      {view === 'summary' ? (
        <div className="mt-6 grid gap-4">
          {attentionClaims.length > 0 ? (
            <Alert
              description={`${attentionClaims.length} claim(s) in this question are contested, refuted, or tainted. Attention level only; it is not a verdict on the question.`}
              title="Needs a closer look"
              variant="warning"
            />
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Research scope (Contract r{contract.revision})</h2>
                <p className="mt-2 font-medium">{contract.title ?? contract.contractId}</p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-5">
                  {currentRevision.statement ? (<><dt className="text-muted-foreground">Answers</dt><dd>{currentRevision.statement}</dd></>) : null}
                  {scopeSource.scope ? (<><dt className="text-muted-foreground">Scope</dt><dd>{currentRevision.scope}</dd></>) : null}
                  {scopeSource.exclusions ? (<><dt className="text-muted-foreground">Exclusions</dt><dd>{currentRevision.exclusions}</dd></>) : null}
                  {scopeSource.falsification ? (<><dt className="text-muted-foreground">Falsification</dt><dd>{currentRevision.falsification}</dd></>) : null}
                  <dt className="text-muted-foreground">Contract</dt><dd className="font-mono text-xs">{contract.contractId} · r{contract.revision}</dd>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Current frontier</h2>
                {frontier ? (
                  <>
                    <p className="mt-2 text-lg font-medium tabular-nums">Frontier #{frontier.sequence}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <IdChip value={frontier.snapshotId} />
                      <span className="text-xs tabular-nums text-muted-foreground">{frontierMembers.length} member claim(s)</span>
                    </div>
                    {previousSnapshot ? (
                      <Link className="mt-2 inline-block text-xs text-muted-foreground hover:text-foreground" href={`/projects/${question.projectId}/frontier/${previousSnapshot.snapshotId}`}>
                        Previous snapshot #{previousSnapshot.sequence} →
                      </Link>
                    ) : null}
                  </>
                ) : <p className="mt-2 text-sm text-muted-foreground">No frontier published yet for this project.</p>}
              </CardContent>
            </Card>
          </div>
          <section aria-labelledby="workspace-tasks-heading">
            <h2 className="mb-3 text-lg font-semibold" id="workspace-tasks-heading">Open tasks</h2>
            {tasks.length === 0 ? <Empty title="No tasks attached" description="Tasks for this question will appear here when opened." /> : (
              <Card className="divide-y divide-border">
                {tasks.slice(0, 6).map((task) => (
                  <div className="flex flex-wrap items-center gap-3 px-5 py-3" key={task.taskId}>
                    <StatusBadge state={task.status ?? task.state ?? 'open'} />
                    <IdChip value={task.taskId} /><Link className="text-xs text-primary hover:underline" href={`/tasks/${task.taskId}`}>open</Link>
                    <span className="ml-auto text-xs text-muted-foreground">{task.status ?? task.state ?? ''}</span>
                  </div>
                ))}
              </Card>
            )}
            <Link className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground" href="/work">Claim work in Work →</Link>
          </section>
        </div>
      ) : null}

      {view === 'frontier' ? (
        <section className="mt-6" aria-labelledby="frontier-heading">
          <h2 className="mb-1 text-lg font-semibold" id="frontier-heading">Frontier members</h2>
          <p className="mb-4 max-w-2xl text-sm text-muted-foreground">Snapshots are immutable: this list is frozen at publication and stays linkable forever.</p>
          {!frontier ? <Empty title="No frontier published yet" description="The project's frontier snapshots will appear here once published." /> : frontierMembers.length === 0 ? (
            <Empty title="This snapshot has no members" description="An empty frontier means no claim revision was accepted into it yet." />
          ) : (
            <Card className="divide-y divide-border">
              {frontierMembers.map((member) => {
                const claim = claims.find((entry) => entry.claimId === (member.claimId ?? entry.claimId));
                return (
                  <div className="flex flex-wrap items-center gap-3 px-5 py-3" key={member.claimId ?? member.id}>
                    <StatusBadge state={claim?.state ?? 'accepted'} />
                    <IdChip value={member.claimId} /><Link className="text-xs text-primary hover:underline" href={`/claims/${member.claimId}`}>open</Link>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">r{member.claimRevision ?? member.revision ?? '?'}</span>
                  </div>
                );
              })}
            </Card>
          )}
          {frontier ? (
            <Link className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground" href={`/projects/${question.projectId}/frontier/${frontier.snapshotId}`}>
              Snapshot detail, policy, and checkpoint →
            </Link>
          ) : null}
        </section>
      ) : null}

      {view === 'argument' ? (
        <section className="mt-6" aria-labelledby="argument-heading">
          <h2 className="mb-1 text-lg font-semibold" id="argument-heading">Argument</h2>
          <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
            Claims relate through fourteen directed edge types forming a DAG, never a parent-child tree. Each claim page carries its graph and an equivalent list view.
          </p>
          {claims.length === 0 ? <Empty title="No claims yet" description="Claims raised under this question will appear here." /> : (
            <Card className="divide-y divide-border">
              {claims.map((claim) => (
                <div className="grid gap-2 px-5 py-4" key={claim.claimId}>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge state={claim.state} />
                    <IdChip value={claim.claimId} /><Link className="text-xs text-primary hover:underline" href={`/claims/${claim.claimId}`}>open</Link>
                  </div>
                  <Link className="max-w-3xl text-sm text-muted-foreground hover:text-foreground" href={`/claims/${claim.claimId}`}>
                    Open evidence, verification, and downstream context →
                  </Link>
                </div>
              ))}
            </Card>
          )}
        </section>
      ) : null}

      {view === 'evidence' ? (
        <section className="mt-6" aria-labelledby="evidence-heading">
          <h2 className="mb-1 text-lg font-semibold" id="evidence-heading">Evidence</h2>
          <p className="mb-4 max-w-2xl text-sm text-muted-foreground">Evidence binds to an exact claim revision through supports, refutes, qualifies, or reproduces. Grouped counts are navigation, not a score.</p>
          {evidence === 'loading' ? <Skeleton className="h-40 w-full" /> : evidence === null || evidence.length === 0 ? (
            <Empty title="No evidence linked yet" description="Evidence attached to this question's claims will appear here, grouped by relation." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {RELATIONS.map((relation) => {
                const items = evidenceByRelation(relation);
                return (
                  <Card key={relation}>
                    <div className="border-b border-border px-5 py-3">
                      <StatusBadge state={relation} />
                      <span className="ml-2 text-xs tabular-nums text-muted-foreground">{items.length}</span>
                    </div>
                    {items.length === 0 ? <p className="px-5 py-4 text-sm text-muted-foreground">None in this question yet.</p> : (
                      <div className="divide-y divide-border">
                        {items.slice(0, 5).map((item) => (
                          <div className="flex flex-wrap items-center gap-2 px-5 py-3" key={item.evidenceId}>
                            <IdChip value={item.evidenceId} />
                            <span className="ml-auto text-xs text-muted-foreground">{item.evidenceType?.replaceAll('_', ' ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {view === 'verification' ? (
        <section className="mt-6 grid gap-4" aria-labelledby="verification-heading">
          <div>
            <h2 className="mb-1 text-lg font-semibold" id="verification-heading">Verification receipts</h2>
            <p className="mb-4 max-w-2xl text-sm text-muted-foreground">Each receipt records an outcome, verification types, independence, and findings. Receipts never collapse into a single score.</p>
            {receipts === 'loading' ? <Skeleton className="h-32 w-full" /> : receipts === null || receipts.length === 0 ? (
              <Empty title="No receipts yet" description="Verification receipts for this question's claims will appear here." />
            ) : (
              <Card className="divide-y divide-border">
                <div className="flex flex-wrap gap-2 px-5 py-3">
                  <StatusBadge state="supports" label={`outcome supports ${outcomeCount('supports')}`} />
                  <StatusBadge state="refutes" label={`outcome refutes ${outcomeCount('refutes')}`} />
                  <StatusBadge state="qualifies" label={`outcome qualifies ${outcomeCount('qualifies')}`} />
                  <StatusBadge state="update" label={`inconclusive ${outcomeCount('inconclusive')}`} />
                  {topFindingSeverity ? <StatusBadge state="critical" label={`top finding ${topFindingSeverity}`} /> : null}
                </div>
                {receipts.slice(0, 10).map((receipt) => (
                  <div className="flex flex-wrap items-center gap-3 px-5 py-3" key={receipt.receiptId}>
                    <StatusBadge state={receipt.outcome} />
                    <IdChip value={receipt.receiptId} />
                    {receipt.claimId ? <><IdChip value={receipt.claimId} /><Link className="text-xs text-primary hover:underline" href={`/claims/${receipt.claimId}`}>open</Link></> : null}
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{receipt.implementationRelation ?? ''}{receipt.contextMode ? ` · ${receipt.contextMode}` : ''}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Challenges</h2>
            <Empty
              action={<Link className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" href="/challenges/new">Raise a challenge</Link>}
              description="Challenges are tracked per claim revision. Open the target claim to read an active challenge and its impact; raising one is always reachable from here."
              title="Challenge tracking lives on each claim"
            />
          </div>
        </section>
      ) : null}

      {view === 'activity' ? (
        <section className="mt-6" aria-labelledby="activity-heading">
          <h2 className="mb-1 text-lg font-semibold" id="activity-heading">Activity</h2>
          <p className="mb-4 max-w-2xl text-sm text-muted-foreground">Signed research events for this question. Hashes and signatures stay in the event audit, one layer down.</p>
          {events.length === 0 ? <Empty title="No events in range" description="Signed events for this question will appear here as they happen." /> : (
            <Card className="px-5 py-2">
              <ol className="list-none">
                {events.map((event) => {
                  const type = event.eventType ?? 'event';
                  const EventIcon = type.startsWith('frontier') ? Mountain : type.startsWith('claim') ? Flag : type.startsWith('evidence') ? FlaskConical : History;
                  return (
                    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-border py-4 last:border-b-0" key={event.eventId}>
                      <span aria-hidden="true" className="mt-0.5 grid size-8 place-items-center rounded-full bg-muted text-muted-foreground"><EventIcon size={15} /></span>
                      <div className="min-w-0">
                        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{type}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <IdChip value={event.eventId} />
                          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{relativeTime(event.createdAt)}</span>
                        </div>
                        {event.actorId ? (
                          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            Contributed by
                            <Link className="font-medium text-foreground hover:underline" href={`/contributors/${encodeURIComponent(event.actorId)}`}>{event.actorId}</Link>
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}
          <Link className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground" href="/events">Full event audit with hashes and signatures →</Link>
        </section>
      ) : null}

      <HandoffSheet
        cliCommand={`sq question list --project ${question.projectId}   # find this question's state\nsq task list --status open             # open tasks to pick up`}
        intent="Continue this question with your agent"
        mcpCall={`tool:     search_open_tasks (read-only)\nresource: evimesh://projects/${question.projectId}/frontier/latest`}
        objectId={question.questionId}
        objectType="question"
        onOpenChange={setHandoffOpen}
        open={handoffOpen}
        revision={currentRevision.revision}
        scopes={['read', 'drafts']}
        view={view}
      />
    </PageContainer>
  );
}
