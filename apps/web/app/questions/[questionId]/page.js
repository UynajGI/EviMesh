'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, StatusBadge } from '@/components/ui/data';
import { Alert, Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
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
  const [data, setData] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { Promise.resolve(params).then(({ questionId: value }) => setQuestionId(value)); }, [params]);

  async function load() {
    setError(null);
    try {
      const question = await request(`/questions/${questionId}`);
      const projectId = question.question.projectId;
      const [tasks, frontier, claimPage, events] = await Promise.all([
        request(`/tasks?projectId=${projectId}&limit=12`).then((body) => body.items ?? []),
        request(`/projects/${projectId}/frontier/latest`).then((body) => body.frontier ?? null).catch(() => null),
        request(`/claims?projectId=${projectId}&limit=100`).then((body) => body.items ?? []).catch(() => []),
        request(`/events?objectType=question&objectId=${questionId}&limit=20`).then((body) => body.items ?? []).catch(() => []),
      ]);
      const claims = claimPage.filter((claim) => !claim.questionId || claim.questionId === questionId);
      setData({ ...question, tasks, frontier, claims, events });
    } catch (reason) {
      setError(reason.message);
    }
  }

  useEffect(() => { if (questionId) load(); }, [questionId]);

  const claimIds = (data?.claims ?? []).map((claim) => claim.claimId).slice(0, 8);

  /* Evidence and receipts load lazily, once, on their first tab view. */
  useEffect(() => {
    if (view !== 'evidence' || evidence !== null || !data) return;
    setEvidence('loading');
    Promise.all(claimIds.map((id) => request(`/evidence?claimId=${id}&limit=50`).then((body) => body.items ?? []).catch(() => [])))
      .then((groups) => setEvidence(groups.flat()))
      .catch(() => setEvidence([]));
  }, [view, data, evidence, claimIds.join(',')]);

  useEffect(() => {
    if (view !== 'verification' || receipts !== null || !data) return;
    setReceipts('loading');
    Promise.all(claimIds.map((id) => request(`/claims/${id}/verifications`).then((body) => body.items ?? body.receipts ?? []).catch(() => [])))
      .then((groups) => setReceipts(groups.flat()))
      .catch(() => setReceipts([]));
  }, [view, data, receipts, claimIds.join(',')]);

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>;

  const { question, currentRevision, contract, tasks, frontier, claims, events } = data;
  const attentionClaims = claims.filter((claim) => ATTENTION_STATES.has(claim.state));
  const frontierMembers = Array.isArray(frontier?.members) ? frontier.members : [];

  const evidenceByRelation = (relation) => (evidence ?? []).filter((item) => (item.links ?? []).some((link) => link.relationType === relation));
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
        <span aria-current="page" className="tabular-nums">{question.questionId}</span>
      </nav>

      <PageHeader
        action={(
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted" href={`/projects/${question.projectId}`}>Open project</Link>
            <Link className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-accent-foreground/90" href="/agent">Continue with an agent</Link>
          </div>
        )}
        description={currentRevision.statement}
        eyebrow={`Question · r${currentRevision.revision ?? 1}`}
        title={currentRevision.title}
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <StatusBadge state={question.state} />
        <IdChip label="question" value={question.questionId} />
        {frontier ? <span className="text-xs tabular-nums text-muted-foreground">Frontier #{frontier.sequence}</span> : null}
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Research Contract</h2>
                <p className="mt-2 font-medium">{contract.title ?? contract.contractId}</p>
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">{contract.contractId} · revision {contract.revision}</p>
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
                    <Link className="hover:underline" href={`/tasks/${task.taskId}`}><IdChip value={task.taskId} /></Link>
                    <span className="ml-auto text-xs text-muted-foreground">{task.status ?? task.state ?? ''}</span>
                  </div>
                ))}
              </Card>
            )}
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
                    <Link className="min-w-0 hover:underline" href={`/claims/${member.claimId}`}><IdChip value={member.claimId} /></Link>
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
                    <Link className="min-w-0 hover:underline" href={`/claims/${claim.claimId}`}><IdChip value={claim.claimId} /></Link>
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
                    {receipt.claimId ? <Link className="hover:underline" href={`/claims/${receipt.claimId}`}><IdChip value={receipt.claimId} /></Link> : null}
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
            <Card className="divide-y divide-border">
              {events.map((event) => (
                <div className="flex flex-wrap items-center gap-3 px-5 py-3" key={event.eventId}>
                  <span className="font-mono text-xs text-muted-foreground">{event.eventType ?? 'event'}</span>
                  <IdChip value={event.eventId} />
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{relativeTime(event.createdAt)}</span>
                </div>
              ))}
            </Card>
          )}
          <Link className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground" href="/events">Full event audit with hashes and signatures →</Link>
        </section>
      ) : null}
    </PageContainer>
  );
}
