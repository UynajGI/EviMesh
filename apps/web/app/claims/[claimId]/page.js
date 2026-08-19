'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClaimDag } from '@/components/claim-dag';
import { HandoffSheet } from '@/components/handoff-sheet';
import { Badge, Card, CardContent, StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { hydrateEvidenceLinks, hydrateReceiptFindings, evidenceRelations } from '@/lib/hydrate';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const RELATIONS = ['supports', 'refutes', 'qualifies', 'reproduces'];
const OUTCOMES = ['supports', 'refutes', 'qualifies', 'inconclusive'];

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Claim data is unavailable.');
  return payload;
}

function JsonBlock({ value }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">{JSON.stringify(value ?? [], null, 2)}</pre>;
}

/*
 * Claim detail (M13.8 05-core-ui-spec.md §6): serif statement, structured
 * fields, DAG graph with an equivalent keyboard-reachable list view, revision
 * history, and a status-summary rail. Counts are entry points, never scores.
 */
export default function ClaimDetailPage({ params }) {
  const [claimId, setClaimId] = useState(null);
  const [data, setData] = useState(null);
  const [graph, setGraph] = useState(null);
  const [direction, setDirection] = useState('downstream');
  const [graphView, setGraphView] = useState('graph');
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [evidence, setEvidence] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => { Promise.resolve(params).then(({ claimId: value }) => setClaimId(value)); }, [params]);

  async function load() {
    setError(null);
    try {
      const payload = await request(`/claims/${claimId}`);
      const [evidenceItems, receiptItems] = await Promise.all([
        request(`/evidence?claimId=${claimId}&limit=100`).then((body) => body.items ?? []).catch(() => []),
        request(`/claims/${claimId}/verifications`).then((body) => body.items ?? body.receipts ?? []).catch(() => []),
      ]);
      /* List rows carry no relations: evidence links live on /evidence/:id
       * (claimLinks) and receipt findings on /verifications/:receiptId. */
      setEvidence(await hydrateEvidenceLinks(API, evidenceItems));
      setReceipts(await hydrateReceiptFindings(API, receiptItems));
      setData(payload);
    } catch (reason) {
      setError(reason.message);
    }
  }

  useEffect(() => { if (claimId) load(); }, [claimId]);
  useEffect(() => { if (claimId) request(`/claims/${claimId}/graph?direction=${direction}&maxDepth=3`).then(setGraph).catch((reason) => setError(reason.message)); }, [claimId, direction]);

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>;

  const { claim, currentRevision, statusPolicy } = data;
  const graphNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const graphEntries = graphNodes.map((node) => ({ id: node.claimId ?? node.id, state: node.state ?? node.status })).filter((node) => typeof node.id === 'string' && node.id !== claim.claimId);
  const dagElements = [{ data: { id: claim.claimId, label: claim.claimId, state: claim.state } }, ...graphEntries.map(({ id, state }) => ({ data: { id, label: id, state } })), ...graphEntries.map(({ id }) => ({ data: { id: `${direction}-${id}`, source: direction === 'upstream' ? id : claim.claimId, target: direction === 'upstream' ? claim.claimId : id } }))];

  const evidenceFor = (relation) => evidence.filter((item) => evidenceRelations(item).includes(relation));
  const receiptsFor = (outcome) => receipts.filter((receipt) => receipt.outcome === outcome);
  const topFinding = receipts.reduce((top, receipt) => {
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
        {claim.questionId ? <Link className="tabular-nums hover:text-foreground" href={`/questions/${claim.questionId}`}>{claim.questionId}</Link> : <span>Claims</span>}
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="tabular-nums">{claim.claimId}</span>
      </nav>

      <PageHeader
        action={(
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted" href={`/claims/${claim.claimId}/diff`}>Revision diff</Link>
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-accent-foreground/90" onClick={() => setHandoffOpen(true)} type="button">Continue with an agent</button>
          </div>
        )}
        description={claim.questionId ? null : 'Not linked to a question yet.'}
        eyebrow={`Claim · r${currentRevision.revision}`}
        title={claim.claimId}
      />

      {/* The statement IS the headline: serif reading mode, no rhetorical title. */}
      <div className="mt-5 grid gap-4">
        <p className="max-w-[65ch] font-serif text-lg leading-relaxed">{currentRevision.statement}</p>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge state={claim.state} />
          <Badge variant="default">revision r{currentRevision.revision}</Badge>
          <IdChip label="claim" value={claim.claimId} />
          {claim.questionId ? <Link className="text-xs tabular-nums text-muted-foreground hover:text-foreground" href={`/questions/${claim.questionId}`}>question {claim.questionId}</Link> : null}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="grid min-w-0 gap-8">
          <section aria-labelledby="fields-heading">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground" id="fields-heading">Statement and structured fields</h2>
            <Card>
              <CardContent className="grid gap-5">
                <p className="max-w-[65ch] font-serif text-base leading-relaxed">{currentRevision.statement}</p>
                <div className="grid gap-4">
                  <div><h3 className="text-sm font-medium">Scope</h3><JsonBlock value={currentRevision.scope} /></div>
                  <div><h3 className="text-sm font-medium">Assumptions</h3><JsonBlock value={currentRevision.assumptions} /></div>
                  <div><h3 className="text-sm font-medium">Falsification conditions</h3><JsonBlock value={currentRevision.falsification ?? currentRevision.falsificationConditions} /></div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="graph-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold" id="graph-heading">Claim dependency graph</h2>
              <div className="flex flex-wrap gap-2">
                <div className="flex gap-1" role="tablist" aria-label="Graph or list view">
                  {[['graph', 'Graph'], ['list', 'List']].map(([id, label]) => (
                    <button
                      aria-selected={graphView === id}
                      className={cn('h-8 rounded-md px-3 text-sm font-medium', graphView === id ? 'bg-accent text-accent-foreground' : 'border border-border bg-card text-muted-foreground hover:text-foreground')}
                      key={id}
                      onClick={() => setGraphView(id)}
                      role="tab"
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button className={cn('h-8 rounded-md px-3 text-sm font-medium', direction === 'upstream' ? 'bg-accent text-accent-foreground' : 'border border-border bg-card text-muted-foreground hover:text-foreground')} type="button" onClick={() => setDirection('upstream')}>Upstream</button>
                  <button className={cn('h-8 rounded-md px-3 text-sm font-medium', direction === 'downstream' ? 'bg-accent text-accent-foreground' : 'border border-border bg-card text-muted-foreground hover:text-foreground')} type="button" onClick={() => setDirection('downstream')}>Downstream</button>
                </div>
              </div>
            </div>
            {graphView === 'graph' ? <ClaimDag elements={dagElements} /> : (
              <div>
                {graphEntries.length === 0 ? (
                  <Empty title={`No ${direction} relations in range`} description="Relations of this claim within three hops will be listed here; the graph shows the same set." />
                ) : (
                  <Card className="divide-y divide-border">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Direction</span><span>Related claim</span><span>State</span>
                    </div>
                    {graphEntries.map(({ id, state }) => (
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-sm" key={id}>
                        <span className="capitalize text-muted-foreground">{direction}</span>
                        <IdChip value={id} /><Link className="text-xs text-primary hover:underline" href={`/claims/${id}`}>open</Link>
                        {state ? <StatusBadge state={state} /> : <span className="text-xs text-muted-foreground">unknown</span>}
                      </div>
                    ))}
                  </Card>
                )}
                <p className="mt-2 text-sm text-muted-foreground">The list view is the keyboard-reachable equivalent of the graph; both show the same relations.</p>
              </div>
            )}
          </section>

          <section aria-labelledby="revisions-heading">
            <h2 className="mb-3 text-lg font-semibold" id="revisions-heading">Revision history</h2>
            <Card>
              <CardContent>
                <p className="font-mono text-sm tabular-nums">Revision {currentRevision.revision}</p>
                <p className="mt-2 text-sm text-muted-foreground">Current immutable revision; previous revisions are linked by `supersedes`.</p>
                {currentRevision.supersedes ? <p className="mt-2 text-xs text-muted-foreground">Supersedes revision {currentRevision.supersedes}.</p> : null}
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="technical-heading">
            <details className="rounded-lg border border-border bg-card">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium" id="technical-heading">Technical details (ids, hashes, policy)</summary>
              <div className="border-t border-border px-5 py-4">
                <dl className="grid gap-2 text-sm sm:grid-cols-[max-content_1fr]">
                  <dt className="text-muted-foreground">Stable id</dt><dd className="font-mono tabular-nums">{claim.claimId}</dd>
                  <dt className="text-muted-foreground">Current revision</dt><dd className="font-mono tabular-nums">r{currentRevision.revision}</dd>
                  <dt className="text-muted-foreground">Next allowed states</dt><dd className="font-mono tabular-nums">{statusPolicy.allowedTransitions.join(', ') || 'No transitions'}</dd>
                </dl>
              </div>
            </details>
          </section>
        </div>

        {/* Status summary rail: grouped counts as navigation, never a score. */}
        <aside aria-label="Status summary">
          <Card>
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Status summary</h2>
            </div>
            <CardContent className="grid gap-5">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence by relation</h3>
                <div className="mt-2 grid gap-1.5">
                  {RELATIONS.map((relation) => (
                    <div className="flex items-center justify-between gap-3" key={relation}>
                      <StatusBadge state={relation} />
                      <span className="text-sm tabular-nums text-muted-foreground">{evidenceFor(relation).length}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verification outcomes</h3>
                <div className="mt-2 grid gap-1.5">
                  {OUTCOMES.map((outcome) => (
                    <div className="flex items-center justify-between gap-3" key={outcome}>
                      <StatusBadge state={outcome} />
                      <span className="text-sm tabular-nums text-muted-foreground">{receiptsFor(outcome).length}</span>
                    </div>
                  ))}
                </div>
                {topFinding ? (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Top open finding</span>
                    <StatusBadge state={topFinding === 'critical' ? 'critical' : 'attention'} label={topFinding} />
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">Counts are entry points, never scores. Every number opens onto the exact revision, receipt, or event behind it.</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <HandoffSheet
        cliCommand={`sq claims inspect ${claim.claimId} --rev ${currentRevision.revision}`}
        intent="Advance this claim with your agent"
        mcpCall={`resource: evimesh://claims/${claim.claimId}?rev=${currentRevision.revision}\ntool:     draft_evidence (confirm: true)`}
        objectId={claim.claimId}
        objectType="claim"
        onOpenChange={setHandoffOpen}
        open={handoffOpen}
        revision={currentRevision.revision}
        scopes={['evidence:write', 'drafts', 'verification:request']}
        view="argument"
      />
    </PageContainer>
  );
}
