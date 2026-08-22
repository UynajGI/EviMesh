'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';


import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClaimDag } from '@/components/claim-dag';
import { actorHref } from '@/components/attribution';
import { HandoffSheet } from '@/components/handoff-sheet';
import { Badge, Card, CardContent, StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { hydrateEvidenceLinks, hydrateReceiptFindings, evidenceRelations } from '@/lib/hydrate';
import { useVisitRecord } from '@/lib/visit-history';
import { recordView } from '@/lib/interactions';
import { claimLayoutEndpoints } from '@/lib/claim-graph-layout.mjs';
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

/** Newest timestamp of a sparse list, rendered as a short date. */
function latestStamp(values) {
  const stamps = values.filter(Boolean).map((value) => Date.parse(value)).filter((stamp) => !Number.isNaN(stamp));
  if (stamps.length === 0) return 'unavailable';
  return new Date(Math.max(...stamps)).toISOString().slice(0, 10);
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
  const [frontierMembership, setFrontierMembership] = useState(null);
  const [data, setData] = useState(null);
  const [graph, setGraph] = useState(null);
  /* Keep the API traversal names, but describe all typed edges neutrally. */
  const [direction, setDirection] = useState('upstream');
  const [graphView, setGraphView] = useState('graph');
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [watched, setWatched] = useState(false);
  const [shared, setShared] = useState(false);
  const [revisionDiff, setRevisionDiff] = useState(null);
  const [revisionList, setRevisionList] = useState(null);
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
      /* Frontier membership: check the question's latest frontier members. */
      if (payload.claim?.questionId) {
        try {
          const qDetail = await request(`/questions/${payload.claim.questionId}`);
          const projectId = qDetail.question?.projectId;
          if (projectId) {
            const frontier = await request(`/projects/${projectId}/frontier/latest`).then((body) => body.frontier).catch(() => null);
            if (frontier?.snapshotId) {
              const history = await request(`/projects/${projectId}/frontier/history?limit=100`).then((body) => body.items ?? []).catch(() => []);
              const match = history.find((snapshot) => snapshot.snapshotId === frontier.snapshotId);
              const members = (match?.members ?? []).filter((member) => member.claimId === payload.claim.claimId);
              setFrontierMembership(members.length > 0 ? { sequence: frontier.sequence, revision: members[0].claimRevision } : null);
            }
          }
        } catch { /* frontier context unavailable */ }
      }
      setData(payload);
      /* Append-only revision list (mockup 修订历史): bounded walk of the
       * revision detail endpoint, oldest first. The full field diff page
       * stays the deeper comparison surface. */
      const total = payload.currentRevision?.revision;
      if (Number.isInteger(total) && total >= 1) {
        const bounds = Math.min(total, 8);
        Promise.all(Array.from({ length: bounds }, (_, index) => bounds - index).map(async (revisionNumber) => {
          try {
            const detail = await request(`/claims/${claimId}/revisions/${revisionNumber}`);
            const row = detail.revision ?? detail.claimRevision ?? detail ?? {};
            return { revision: revisionNumber, createdAt: row.createdAt ?? null, createdBy: row.createdBy ?? null, statement: row.statement ?? null };
          } catch {
            return { revision: revisionNumber, createdAt: null, createdBy: null, statement: null };
          }
        })).then((rows) => setRevisionList(rows));
      }
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
  useEffect(() => {
    const label = data?.currentRevision?.statement ?? claimId ?? '';
    document.title = label ? `${String(label).slice(0, 48)} · EviMesh` : 'EviMesh';
  }, [data, claimId]);
  /* Local recently-visited rail on Home records this page once its statement is known. */
  useVisitRecord({
    href: claimId ? `/claims/${claimId}` : null,
    label: data?.currentRevision?.statement ? `${String(data.currentRevision.statement).slice(0, 70)}${data.currentRevision.statement.length > 70 ? '…' : ''}` : null,
    kind: 'claim',
  });
  /* Best-effort view signal for the personal recommender (once per session). */
  useEffect(() => { if (claimId) recordView('claim', claimId); }, [claimId]);

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
  const graphEntries = graphNodes.map((node) => ({ id: node.claimId ?? node.id, state: node.state ?? node.status, depth: node.depth })).filter((node) => typeof node.id === 'string' && node.id !== claim.claimId);
  const graphDepthById = new Map([[claim.claimId, 0], ...graphEntries.map(({ id, depth }) => [id, depth])]);
  const graphRelations = Array.isArray(graph?.edges) ? graph.edges : [];
  const dagEdges = graphRelations.length > 0 ? graphRelations.map((edge, index) => ({
    id: edge.id ?? `${direction}-${edge.sourceClaimId}-${edge.targetClaimId}-${edge.relationType ?? index}`,
    /* Reader direction changes traversal, never protocol source/target. */
    source: edge.sourceClaimId,
    target: edge.targetClaimId,
    ...claimLayoutEndpoints({ source: edge.sourceClaimId, target: edge.targetClaimId, sourceDepth: graphDepthById.get(edge.sourceClaimId), targetDepth: graphDepthById.get(edge.targetClaimId), direction }),
    relation: edge.relationType ?? 'depends_on',
  })) : graphEntries.map(({ id, depth }) => {
    const source = direction === 'upstream' ? id : claim.claimId;
    const target = direction === 'upstream' ? claim.claimId : id;
    return { id: `${direction}-${id}`, source, target, ...claimLayoutEndpoints({ source, target, sourceDepth: graphDepthById.get(source) ?? depth, targetDepth: graphDepthById.get(target) ?? depth, direction }), relation: 'depends_on' };
  });
  const dagElements = [{ data: { id: claim.claimId, label: claim.claimId, state: claim.state, depth: 0 } }, ...graphEntries.map(({ id, state, depth }) => ({ data: { id, label: id, state, depth } })), ...dagEdges.map((edge) => ({ data: { ...edge, source: edge.source, target: edge.target, relationType: edge.relation } }))];
  const graphListEntries = graphRelations.length > 0 ? graphRelations.map((edge, index) => {
    const sourceId = edge.sourceClaimId;
    const targetId = edge.targetClaimId;
    const node = targetId === claim.claimId ? claim : graphNodes.find((item) => (item.claimId ?? item.id) === targetId);
    return { sourceId, targetId, relation: edge.relationType ?? 'depends_on', state: node?.state ?? node?.status, key: `${sourceId}-${targetId}-${edge.relationType ?? index}-${index}` };
  }) : graphEntries.map((entry) => ({ sourceId: direction === 'upstream' ? entry.id : claim.claimId, targetId: direction === 'upstream' ? claim.claimId : entry.id, relation: 'depends_on', state: entry.state, key: entry.id }));

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
            {frontierMembership ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2.5 py-0.5 text-xs font-medium text-status-success-fg">
                Frontier #{frontierMembership.sequence} · member
              </span>
            ) : null}
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
                  published by{' '}
                  <Link className="font-medium text-foreground hover:underline" href={actorHref(currentRevision.createdBy ?? claim.createdBy)}>{currentRevision.createdBy ?? claim.createdBy}</Link>
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
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold" id="graph-heading">Claim relation graph</h2>
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
            <p className="mb-3 text-sm text-muted-foreground">{direction === 'upstream' ? 'Upstream context: prerequisites, origins, and prior context.' : 'Downstream context: dependents, responses, and subsequent context.'}</p>
            {graphView === 'graph' ? <ClaimDag elements={dagElements} /> : (
              <div>
                {graphListEntries.length === 0 ? (
                  <Empty title={`No ${direction} relations in range`} description="Relations of this claim within three hops will be listed here; the graph shows the same set." />
                ) : (
                  <Card className="divide-y divide-border">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] gap-3 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Source</span><span>Relation</span><span>Target</span><span>Target state</span>
                    </div>
                    {graphListEntries.map(({ sourceId, targetId, relation, state, key }) => (
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-sm" key={key}>
                        <div className="flex min-w-0 items-center gap-2"><IdChip value={sourceId} /><Link className="shrink-0 text-xs text-primary hover:underline" href={`/claims/${encodeURIComponent(sourceId)}`}>open</Link></div>
                        <span className="font-mono text-xs text-muted-foreground">{relation}</span>
                        <div className="flex min-w-0 items-center gap-2"><IdChip value={targetId} /><Link className="shrink-0 text-xs text-primary hover:underline" href={`/claims/${encodeURIComponent(targetId)}`}>open</Link></div>
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
                <p className="font-mono text-sm tabular-nums">Revision {currentRevision.revision} (current)</p>
                <p className="mt-2 text-sm text-muted-foreground">Immutable and append-only.</p>
                {revisionList && revisionList.length > 0 ? (
                  <ol className="mt-3 divide-y divide-border rounded-lg border border-border">
                    {revisionList.map((row) => (
                      <li className="flex flex-wrap items-baseline gap-3 px-4 py-2.5 text-sm" key={row.revision}>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">r{row.revision}</span>
                        {row.revision === currentRevision.revision ? <span className="rounded-full border border-status-accent-border bg-status-accent-bg px-2 py-0.5 text-[11px] font-medium text-status-accent-fg">current</span> : null}
                        {row.createdBy ? <Link className="text-xs text-muted-foreground hover:text-foreground" href={actorHref(row.createdBy)}>by {row.createdBy}</Link> : null}
                        {row.createdAt ? <span className="ml-auto text-xs tabular-nums text-muted-foreground">{new Date(row.createdAt).toISOString().slice(0, 10)}</span> : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {currentRevision.revision > 8 ? <p className="mt-2 text-xs text-muted-foreground">Newest 8 of {currentRevision.revision} revisions.</p> : null}
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link className="text-sm font-medium text-primary hover:underline" href={`/claims/${claim.claimId}/diff`}>Compare any two revisions field by field →</Link>
                </div>
                {revisionDiff ? (
                  <div className="mt-4">
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

          {/* Mockup claim.html 证据 section: rows grouped by relation, each
              row carrying its provenance (artifact / run) and date. Counts in
              the rail stay entry points; the rows live here. */}
          <section aria-labelledby="evidence-heading">
            <h2 className="mb-1 text-lg font-semibold" id="evidence-heading">Evidence by relation</h2>
            {evidence.length === 0 ? (
              <Empty title="No evidence linked yet" description="Evidence linked to this claim will appear here grouped by its relation to the claim." />
            ) : (
              <div className="grid gap-2">
                {RELATIONS.map((relation) => {
                  const rows = evidenceFor(relation);
                  return (
                    <details className="rounded-lg border border-border bg-card" key={relation}>
                      <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3 text-sm font-medium">
                        <StatusBadge state={relation} />
                        <span className="tabular-nums text-muted-foreground">{rows.length} item{rows.length === 1 ? '' : 's'}</span>
                        <span className="ml-auto text-xs text-muted-foreground">show rows</span>
                      </summary>
                      {rows.length === 0 ? (
                        <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">No {relation} evidence recorded yet.</p>
                      ) : (
                        <ul className="divide-y divide-border border-t border-border">
                          {rows.map((item) => (
                            <li className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm" key={item.evidenceId}>
                              <IdChip value={item.evidenceId} />
                              {item.evidenceType ? <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{item.evidenceType}</span> : null}
                              {item.artifactId ? <span className="font-mono text-xs text-muted-foreground">artifact {item.artifactId}</span> : null}
                              {item.runId ? <span className="font-mono text-xs text-muted-foreground">run {item.runId}</span> : null}
                              {item.createdAt ? <span className="ml-auto text-xs tabular-nums text-muted-foreground">{new Date(item.createdAt).toISOString().slice(0, 10)}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  );
                })}
              </div>
            )}
          </section>

          {/* Mockup claim.html 验证回执 section: fielded receipts with per-
              finding severity rows; receipts never collapse into a score. */}
          <section aria-labelledby="receipts-heading">
            <h2 className="mb-1 text-lg font-semibold" id="receipts-heading">Verification receipts</h2>
            {receipts.length === 0 ? (
              <Empty title="No receipts yet" description="Verification receipts for this claim will appear here as verifiers submit them." />
            ) : (
              <div className="grid gap-3">
                {receipts.slice(0, 10).map((receipt) => (
                  <Card key={receipt.receiptId}>
                    <CardContent>
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge state={receipt.outcome} />
                        <IdChip label="receipt" value={receipt.receiptId} />
                        {receipt.createdAt ? <span className="ml-auto text-xs tabular-nums text-muted-foreground">{new Date(receipt.createdAt).toISOString().slice(0, 10)}</span> : null}
                      </div>
                      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr]">
                        {receipt.verificationTypes ? <><dt className="text-muted-foreground">Verification types</dt><dd className="font-mono text-xs">{receipt.verificationTypes.join(' · ')}</dd></> : null}
                        {receipt.contextMode ? <><dt className="text-muted-foreground">Context mode</dt><dd className="font-mono text-xs">{receipt.contextMode}</dd></> : null}
                        {receipt.implementationRelation ? <><dt className="text-muted-foreground">Implementation</dt><dd className="font-mono text-xs">{receipt.implementationRelation}</dd></> : null}
                        {receipt.dataRelation ? <><dt className="text-muted-foreground">Data</dt><dd className="font-mono text-xs">{receipt.dataRelation}</dd></> : null}
                        {receipt.modelFamily ? <><dt className="text-muted-foreground">Model family</dt><dd className="font-mono text-xs">{receipt.modelFamily}</dd></> : null}
                        {typeof receipt.sawExpectedOutputs === 'boolean' ? <><dt className="text-muted-foreground">Expected outputs</dt><dd>{receipt.sawExpectedOutputs ? 'verifier saw expected outputs' : 'blind: expected outputs not shown'}</dd></> : null}
                      </dl>
                      {(receipt.findings ?? []).length > 0 ? (
                        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                          {receipt.findings.map((finding, index) => (
                            <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm" key={`${receipt.receiptId}-finding-${index}`}>
                              <span className={cn(
                                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                finding.severity === 'critical' ? 'border-transparent bg-emphasis-danger text-emphasis-foreground' : 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
                              )}>
                                {finding.severity}
                              </span>
                              <span className="font-mono text-xs">{finding.code}</span>
                              <span className="min-w-0 flex-1 text-muted-foreground">{finding.summary ?? finding.detail ?? finding.message ?? 'Recorded on the receipt'}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
                {receipts.length > 10 ? <p className="text-xs text-muted-foreground">Showing the newest 10 of {receipts.length} receipts.</p> : null}
              </div>
            )}
          </section>

          <section aria-labelledby="technical-heading">
            <details className="rounded-lg border border-border bg-card">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium" id="technical-heading">Technical details (ids, hashes, policy)</summary>
              <div className="border-t border-border px-5 py-4">
                <dl className="grid gap-2 text-sm sm:grid-cols-[max-content_1fr]">
                  <dt className="text-muted-foreground">Stable id</dt><dd className="font-mono tabular-nums">{claim.claimId}</dd>
                  <dt className="text-muted-foreground">Current revision</dt><dd className="font-mono tabular-nums">r{currentRevision.revision}</dd>
                  <dt className="text-muted-foreground">Next allowed states</dt><dd className="font-mono tabular-nums">{statusPolicy.allowedTransitions.join(', ') || 'No transitions'}</dd>
                  <dt className="text-muted-foreground">Latest event</dt><dd className="font-mono tabular-nums">{data.lastEvent?.eventId ?? 'unavailable'}</dd>
                  <dt className="text-muted-foreground">Event hash</dt><dd className="break-all font-mono tabular-nums text-xs">{data.lastEvent?.hash ?? 'via event audit'}</dd>
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
              {frontierMembership ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frontier membership</h3>
                  <p className="mt-2 text-sm tabular-nums">Frontier #{frontierMembership.sequence} · this claim at r{frontierMembership.revision}</p>
                  <Link className="mt-1 inline-block text-xs text-primary hover:underline" href={`/projects/${claim.projectId ?? ''}`}>Open the project frontier →</Link>
                </div>
              ) : null}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest activity</h3>
                <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                  Latest evidence: {evidence.length > 0 ? latestStamp(evidence.map((item) => item.createdAt)) : 'none yet'}
                </p>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  Latest receipt: {receipts.length > 0 ? latestStamp(receipts.map((item) => item.createdAt)) : 'none yet'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Challenges track on the claim record.</p>
              </div>
              <p className="text-xs text-muted-foreground">Counts are entry points, never scores.</p>
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
