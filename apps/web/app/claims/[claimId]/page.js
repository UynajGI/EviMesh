'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';


import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClaimDag } from '@/components/claim-dag';
import { HandoffSheet } from '@/components/handoff-sheet';
import { Badge, Card, CardContent, StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { hydrateEvidenceLinks, hydrateReceiptFindings, evidenceRelations } from '@/lib/hydrate';
import { PageContainer } from '@/components/ui/page';
import { Check, Eye, Share2 } from 'lucide-react';
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
 * Design book 05 §6 / 09 §2.5 deflist pattern: strings render as prose lines,
 * arrays render as a quiet hairline list, objects fall back to a definition
 * list of their scalar entries. Raw JSON stays in technical details.
 */
function ReadableField({ value }) {
  if (value === null || value === undefined || value === '') {
    return <p className="mt-2 text-sm text-muted-foreground">Not stated in this revision.</p>;
  }
  if (typeof value === 'string') {
    return <p className="mt-2 max-w-[65ch] text-sm leading-6">{value}</p>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="mt-2 text-sm text-muted-foreground">None recorded.</p>;
    useEffect(() => {
    const label = claim.claimId ?? '';
    document.title = label ? `${String(label).slice(0, 48)} · EviMesh` : 'EviMesh';
  }, [claim]);
  return (
      <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
        {value.map((entry, index) => (
          <li className="px-4 py-2.5 text-sm" key={index}>
            {typeof entry === 'string' || typeof entry === 'number' ? entry : <ReadableField value={entry} />}
          </li>
        ))}
      </ul>
    );
  }
  const entries = Object.entries(value).filter(([, entry]) => typeof entry !== 'object' || entry === null);
  if (entries.length === 0) return <div className="mt-2"><JsonBlock value={value} /></div>;
  return (
    <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-5">
      {entries.map(([key, entry]) => (
        <div className="contents" key={key}>
          <dt className="text-muted-foreground">{key.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}</dt>
          <dd>{entry === null ? 'none' : String(entry)}</dd>
        </div>
      ))}
    </dl>
  );
}

/*
 * Claim detail (M13.8 05-core-ui-spec.md §6): serif statement, structured
 * fields, DAG graph with an equivalent keyboard-reachable list view, revision
 * history, and a status-summary rail. Counts are entry points, never scores.
 */
function ClaimDetailView({ params }) {
  const [claimId, setClaimId] = useState(null);
  const searchParams = useSearchParams();
  const pinnedRevision = Number.parseInt(searchParams.get('rev') ?? '', 10);
  const [pinnedRevisionData, setPinnedRevisionData] = useState(null);
  const [data, setData] = useState(null);
  const [graph, setGraph] = useState(null);
  const [direction, setDirection] = useState('downstream');
  const [graphView, setGraphView] = useState('graph');
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [watched, setWatched] = useState(false);
  const [shared, setShared] = useState(false);
  const [revisionDiff, setRevisionDiff] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => { Promise.resolve(params).then(({ claimId: value }) => setClaimId(value)); }, [params]);

  async function load() {
    setError(null);
    try {
      const payload = await request(`/claims/${claimId}`);
      /* A ?rev=N permalink must render that exact immutable revision. */
      if (Number.isInteger(pinnedRevision) && pinnedRevision >= 1) {
        try {
          const pinned = await request(`/claims/${claimId}/revisions/${pinnedRevision}`);
          setPinnedRevisionData(pinned.revision ?? pinned.claimRevision ?? pinned ?? null);
        } catch { /* pinned revision unavailable: fall back to current */ }
      }
      const [evidenceItems, receiptItems] = await Promise.all([
        request(`/evidence?claimId=${claimId}&limit=100`).then((body) => body.items ?? []).catch(() => []),
        request(`/claims/${claimId}/verifications`).then((body) => body.items ?? body.receipts ?? []).catch(() => []),
      ]);
      /* List rows carry no relations: evidence links live on /evidence/:id
       * (claimLinks) and receipt findings on /verifications/:receiptId. */
      setEvidence(await hydrateEvidenceLinks(API, evidenceItems));
      setReceipts(await hydrateReceiptFindings(API, receiptItems));
      setData(payload);
      /* Inline revision diff preview (mockup r(n) vs r(n-1) statement lines):
       * hydrate the current and previous revision when both exist. */
      const revision = payload.currentRevision?.revision;
      if (Number.isInteger(revision) && revision > 1) {
        try {
          const [current, previous] = await Promise.all([
            request(`/claims/${claimId}/revisions/${revision}`),
            request(`/claims/${claimId}/revisions/${revision - 1}`),
          ]);
          const currentStatement = current.revision?.statement ?? current.claimRevision?.statement ?? null;
          const previousStatement = previous.revision?.statement ?? previous.claimRevision?.statement ?? null;
          if (currentStatement && previousStatement && currentStatement !== previousStatement) {
            setRevisionDiff({ from: previousStatement, to: currentStatement, previous: revision - 1 });
          }
        } catch { /* diff preview unavailable; the diff page remains */ }
      }
    } catch (reason) {
      setError(reason.message);
    }
  }

  useEffect(() => { if (claimId) load(); }, [claimId]);
  useEffect(() => {
    try { setWatched(localStorage.getItem(`evimesh-watch-claim-${claimId}`) === '1'); } catch { /* unavailable */ }
  }, [claimId]);
  useEffect(() => { if (claimId) request(`/claims/${claimId}/graph?direction=${direction}&maxDepth=3`).then(setGraph).catch((reason) => setError(reason.message)); }, [claimId, direction]);

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>;

  const { claim, statusPolicy } = data;
  const pinned = Number.isInteger(pinnedRevision) && pinnedRevision >= 1 && pinnedRevisionData;
  /* Evidence links target exact revisions, so claim-wide lists are labeled
   * with a pinned notice instead of silently mixing revisions. */
  const pinnedNotice = pinned ? (
    <p className="mb-3 rounded-md border border-status-accent-border bg-status-accent-bg px-3 py-1.5 text-xs text-status-accent-fg">
      Viewing r{pinnedRevision}. Evidence and receipts below are listed claim-wide; each item carries the revision it links to.
    </p>
  ) : null;
  const currentRevision = pinned ? { ...data.currentRevision, ...pinnedRevisionData, revision: pinnedRevision } : data.currentRevision;
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

      {/* Mockup claim.html header: badge row, serif statement headline,
          meta with attribution chain, then the action slots. */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {pinned ? (
            <p className="mt-2 rounded-md border border-status-accent-border bg-status-accent-bg px-3 py-1.5 text-xs text-status-accent-fg">
              Pinned revision r{pinnedRevision}: this permalink always renders this exact immutable revision. <Link className="underline" href={`/claims/${claim.claimId}`}>Jump to current</Link>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge state={claim.state} label="claim" />
            <Badge variant="default">revision r{currentRevision.revision}</Badge>
            <IdChip label="claim" value={claim.claimId} />
          </div>
          <p className="claim-statement mt-4 max-w-[65ch] font-serif text-lg leading-relaxed">{currentRevision.statement}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {claim.questionId ? <Link className="tabular-nums hover:text-foreground" href={`/questions/${claim.questionId}`}>question {claim.questionId}</Link> : <span>Not linked to a question yet.</span>}
            {(currentRevision.createdBy ?? claim.createdBy) ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  drafted by{' '}
                  <Link className="font-medium text-foreground hover:underline" href={`/contributors/${encodeURIComponent(currentRevision.createdBy ?? claim.createdBy)}`}>{currentRevision.createdBy ?? claim.createdBy}</Link>
                </span>
              </>
            ) : null}
            {currentRevision.createdAt ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">r{currentRevision.revision} published {new Date(currentRevision.createdAt).toISOString().slice(0, 10)}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            aria-pressed={watched}
            className={cn('inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium', watched ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:bg-muted')}
            onClick={() => {
              const next = !watched;
              setWatched(next);
              try {
                if (next) localStorage.setItem(`evimesh-watch-claim-${claimId}`, '1');
                else localStorage.removeItem(`evimesh-watch-claim-${claimId}`);
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
                await navigator.clipboard.writeText(`${window.location.origin}/claims/${claim.claimId}?rev=${currentRevision.revision}`);
                setShared(true);
                setTimeout(() => setShared(false), 2000);
              } catch { /* unavailable */ }
              setTimeout(() => setShared(false), 2000);
            }}
            type="button"
          >
            {shared ? <Check aria-hidden="true" size={14} /> : <Share2 aria-hidden="true" size={14} />}
            {shared ? 'Link copied' : `Share r${currentRevision.revision} permalink`}
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-accent-foreground/90" onClick={() => setHandoffOpen(true)} type="button">Continue with an agent</button>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="grid min-w-0 gap-8">
          <section aria-labelledby="fields-heading">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground" id="fields-heading">Statement and structured fields</h2>
            <Card>
              <CardContent className="grid gap-5">
                <p className="max-w-[65ch] font-serif text-base leading-relaxed">{currentRevision.statement}</p>
                <div className="grid gap-4">
                  {/* Design book 05 §6: readable field values first; the raw JSON
                      stays available in technical details one layer down. */}
                  <div>
                    <h3 className="text-sm font-medium">Scope</h3>
                    <ReadableField value={currentRevision.scope} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Assumptions</h3>
                    <ReadableField value={currentRevision.assumptions} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Falsification conditions</h3>
                    <ReadableField value={currentRevision.falsification ?? currentRevision.falsificationConditions} />
                  </div>
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
                {revisionDiff ? (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statement diff r{revisionDiff.previous} to r{currentRevision.revision}</p>
                    <pre className="overflow-x-auto rounded-md border border-border font-mono text-xs leading-5">
                      <span className="block bg-status-danger-bg px-3 py-1.5 text-status-danger-fg line-through">- {revisionDiff.from}</span>
                      <span className="block bg-status-success-bg px-3 py-1.5 text-status-success-fg">+ {revisionDiff.to}</span>
                    </pre>
                  </div>
                ) : null}
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
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Raw structured fields</p>
                <div className="grid gap-3">
                  <div><p className="text-xs text-muted-foreground">scope</p><JsonBlock value={currentRevision.scope} /></div>
                  <div><p className="text-xs text-muted-foreground">assumptions</p><JsonBlock value={currentRevision.assumptions} /></div>
                  <div><p className="text-xs text-muted-foreground">falsification</p><JsonBlock value={currentRevision.falsification ?? currentRevision.falsificationConditions} /></div>
                </div>
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
              {pinnedNotice}
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
        cliCommand={`sq provenance ${claim.claimId}   # inspect the dependency path\nsq verify checkout ${claim.claimId}   # lock r${currentRevision.revision} for verification`}
        intent="Advance this claim with your agent"
        mcpCall={`resource: evimesh://claims/${claim.claimId}/revisions/${currentRevision.revision}\ntool:     attach_evidence (confirm: true)`}
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

export default function ClaimDetailPage(props) {
  return (<Suspense fallback={<PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>}><ClaimDetailView {...props} /></Suspense>);
}
