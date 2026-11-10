'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { ClaimDag } from '@/components/claim-dag';
import { HandoffSheet } from '@/components/handoff-sheet';
import { Badge, StatusBadge } from '@/components/ui/data';
import { Button } from '@/components/ui/button';
import { Alert, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Breadcrumb } from '@/components/ui/page';
import {
  ActorName, Clause, ClauseRail, Identifier, MarginSection, ProseList, TitleBlock, formatDate,
} from '@/components/ui/doc';
import { hydrateEvidenceLinks, hydrateReceiptFindings, evidenceRelations } from '@/lib/hydrate';
import { useVisitRecord } from '@/lib/visit-history';
import { recordView, useMyInteractions } from '@/lib/interactions';
import { claimLayoutEndpoints } from '@/lib/claim-graph-layout.mjs';
import { RESEARCH_NODE_DEFINITIONS } from '@/lib/research-neighborhood.mjs';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const RELATIONS = ['supports', 'refutes', 'qualifies', 'reproduces'];
const RESPONSE_KINDS = new Set(['evaluation', 'rebuttal', 'answer', 'challenge']);

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Claim data is unavailable.');
  return payload;
}

function JsonBlock({ value }) {
  return <pre className="mt-2 overflow-x-auto border border-border bg-muted p-3 font-mono text-xs leading-6">{JSON.stringify(value ?? [], null, 2)}</pre>;
}

function readable(value) {
  return String(value ?? '').replaceAll('_', ' ');
}

function hrefFor(kind, id) {
  const prefix = RESEARCH_NODE_DEFINITIONS[kind]?.hrefPrefix;
  return prefix ? `${prefix}/${encodeURIComponent(id)}` : `/events?objectId=${encodeURIComponent(id)}`;
}

/* A typed response (evaluation, rebuttal, answer) read from its signed
 * creation Event: the Event carries the typed document and both actors. */
function responseFromEvent(event) {
  const payload = event.payload ?? {};
  const doc = payload.typed_document ?? {};
  const revision = payload.revision ?? doc.revision ?? 1;
  return {
    key: `${payload.entity_id}@${revision}`,
    kind: payload.entity_type,
    id: payload.entity_id,
    revision,
    stance: doc.stance ?? null,
    title: doc.title ?? doc.rationale ?? doc.synthesis ?? null,
    body: doc.title ? (doc.argument ?? doc.rationale ?? doc.synthesis ?? null) : (doc.method ? `Method: ${doc.method}` : null),
    drafter: payload.drafted_by_actor_id ?? payload.producer_actor_id ?? payload.actor_id ?? null,
    signer: payload.publisher_actor_id ?? payload.signer_actor_id ?? null,
    createdAt: event.createdAt ?? null,
  };
}

/* Readable structured field: protocol strings as a ruled prose list, objects
 * as a definition list. Raw JSON stays in Technical details. */
function ReadableField({ value }) {
  if (value === null || value === undefined || value === '') return <p className="clause__none">Not stated.</p>;
  if (typeof value === 'string' || Array.isArray(value)) return <ProseList items={value} empty="Not stated." />;
  const entries = Object.entries(value).filter(([, entry]) => typeof entry !== 'object' || entry === null);
  if (entries.length === 0) return <JsonBlock value={value} />;
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      {entries.map(([key, entry]) => (
        <div className="contents" key={key}>
          <dt className="text-muted-foreground">{key.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}</dt>
          <dd className="font-serif">{entry === null ? 'none' : String(entry)}</dd>
        </div>
      ))}
    </dl>
  );
}

function RefMeta({ date, id, revision }) {
  return (
    <div className="text-xs text-muted-foreground md:text-right">
      {date ? <span className="tabular-nums" title={id}>{date}</span> : null}
      {revision ? <span className="ml-2 font-mono">r{revision}</span> : null}
    </div>
  );
}

/*
 * Claim detail, the yardstick of the controlled-document grammar
 * (.impeccable/surfaces/app-claims-claimid-page-js.md): a ruled title block
 * for identity and attribution, numbered citable clauses for content and
 * responses, a margin revision ledger, and the typed research graph with its
 * keyboard-reachable Relationship Index. Counts only open records.
 */
function ClaimDetailView({ params }) {
  const [claimId, setClaimId] = useState(null);
  const searchParams = useSearchParams();
  const pinnedRevision = Number.parseInt(searchParams.get('rev') ?? '', 10);
  const [pinnedRevisionData, setPinnedRevisionData] = useState(null);
  const [frontierMembership, setFrontierMembership] = useState(null);
  const [data, setData] = useState(null);
  const [question, setQuestion] = useState(null);
  const [events, setEvents] = useState([]);
  const [graph, setGraph] = useState(null);
  const [neighborhood, setNeighborhood] = useState(null);
  /* Keep the API traversal names, but describe all typed edges neutrally. */
  const [direction, setDirection] = useState('both');
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [revisionDiff, setRevisionDiff] = useState(null);
  const [revisionList, setRevisionList] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState(null);
  const { mine: interactions, ready: interactionsReady, has: hasInteraction, toggle: toggleInteraction } = useMyInteractions();
  const watched = hasInteraction('claim', claimId, 'watch');

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
      const [evidenceItems, receiptItems, eventItems, neighborhoodBody] = await Promise.all([
        request(`/evidence?claimId=${claimId}&limit=100`).then((body) => body.items ?? []).catch(() => []),
        request(`/claims/${claimId}/verifications`).then((body) => body.items ?? body.receipts ?? []).catch(() => []),
        /* Signed creation Events carry the drafter, the human signer and the
         * typed documents of every response that names this claim. */
        request(`/events?objectType=claim&objectId=${claimId}&order=asc&limit=100`).then((body) => body.items ?? []).catch(() => []),
        request(`/research-graph/claim/${encodeURIComponent(claimId)}/neighborhood?direction=both&depth=3`).catch(() => null),
      ]);
      setEvents(eventItems);
      setNeighborhood(neighborhoodBody?.nodes ? neighborhoodBody : null);
      /* List rows carry no relations: evidence links live on /evidence/:id
       * (claimLinks) and receipt findings on /verifications/:receiptId. */
      setEvidence(await hydrateEvidenceLinks(API, evidenceItems));
      setReceipts(await hydrateReceiptFindings(API, receiptItems));
      if (payload.claim?.questionId) {
        try {
          const questionBody = await request(`/questions/${payload.claim.questionId}`).catch(() => null);
          setQuestion(questionBody ? { title: questionBody.currentRevision?.title ?? null, projectId: questionBody.question?.projectId ?? null } : null);
          /* The claim row carries its own projectId; only fall back to the
           * question detail when the row predates that column. */
          const projectId = payload.claim.projectId ?? questionBody?.question?.projectId ?? null;
          if (projectId) {
            const frontier = await request(`/projects/${projectId}/frontier/latest`).then((body) => body.frontier).catch(() => null);
            if (frontier?.snapshotId) {
              const history = await request(`/projects/${projectId}/frontier/history?limit=100`).then((body) => body.items ?? []).catch(() => []);
              const match = history.find((snapshot) => snapshot.snapshotId === frontier.snapshotId);
              const members = (match?.members ?? []).filter((member) => member.claimId === payload.claim.claimId);
              setFrontierMembership(members.length > 0 ? { sequence: frontier.sequence, revision: members[0].claimRevision, projectId } : null);
            }
          }
        } catch { /* question and frontier context unavailable */ }
      }
      setData(payload);
      /* Append-only revision ledger: bounded walk of the revision detail
       * endpoint, newest first. The field diff page stays the deeper view. */
      const total = payload.currentRevision?.revision;
      if (Number.isInteger(total) && total >= 1) {
        const bounds = Math.min(total, 8);
        Promise.all(Array.from({ length: bounds }, (_, index) => total - index).map(async (revisionNumber) => {
          try {
            const detail = await request(`/claims/${claimId}/revisions/${revisionNumber}`);
            const row = detail.revision ?? detail.claimRevision ?? detail ?? {};
            return { revision: revisionNumber, createdAt: row.createdAt ?? null, createdBy: row.createdBy ?? null, statement: row.statement ?? null };
          } catch {
            return { revision: revisionNumber, createdAt: null, createdBy: null, statement: null };
          }
        })).then((rows) => setRevisionList(rows));
      }
      /* Statement change against the previous revision drives the change bar. */
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
  /* Legacy Claim graph: the source for claims recorded before typed research
   * events. The typed neighborhood replaces it when it carries more nodes. */
  useEffect(() => {
    if (!claimId) return undefined;
    let cancelled = false;
    const readDirection = async (value) => {
      const body = await request(`/claims/${claimId}/graph?direction=${value}&maxDepth=3`);
      return {
        ...body,
        nodes: (body.nodes ?? []).map((node) => ({ ...node, direction: node.claimId === claimId || node.id === claimId ? null : value })),
      };
    };
    const loadGraph = direction === 'both'
      ? Promise.all([readDirection('upstream'), readDirection('downstream')]).then(([upstream, downstream]) => {
        const nodes = new Map([...upstream.nodes, ...downstream.nodes].map((node) => [node.nodeId ?? node.objectId ?? node.claimId ?? node.id, node]));
        const edges = new Map([...(upstream.edges ?? []), ...(downstream.edges ?? [])].map((edge, index) => [edge.edgeId ?? edge.id ?? `${edge.sourceNodeId ?? edge.sourceClaimId ?? edge.source}:${edge.targetNodeId ?? edge.targetClaimId ?? edge.target}:${index}`, edge]));
        return { nodes: [...nodes.values()], edges: [...edges.values()], complete: !upstream.truncated && !downstream.truncated, truncated: upstream.truncated || downstream.truncated };
      })
      : readDirection(direction).then((body) => ({ ...body, complete: !body.truncated }));
    loadGraph
      .then((body) => { if (!cancelled) setGraph(body); })
      .catch(() => { if (!cancelled) setGraph({ nodes: [], edges: [], complete: false, truncated: false }); });
    return () => { cancelled = true; };
  }, [claimId, direction]);
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

  if (error) return <div className="doc-page pb-20 pt-10"><ErrorState message={error} onRetry={load} /></div>;
  if (!data) return <ClaimSkeleton />;

  const { claim, statusPolicy } = data;
  const pinned = Number.isInteger(pinnedRevision) && pinnedRevision >= 1 && pinnedRevisionData;
  const currentRevision = pinned ? { ...data.currentRevision, ...pinnedRevisionData, revision: pinnedRevision } : data.currentRevision;
  const latestRevision = data.currentRevision?.revision ?? currentRevision.revision;

  /* Attribution chain. Legacy rows carry originatorContributions; typed
   * submissions carry the drafter and the human publisher on the signed
   * creation Event. An Agent is never shown as the signer. */
  const creation = events.find((event) => event.eventType === 'claim.created' && (event.payload?.entity_id ?? event.payload?.claim_id) === claim.claimId) ?? null;
  const legacyContribution = (Array.isArray(data.originatorContributions) ? data.originatorContributions : [])
    .find((contribution) => contribution.draftedByActorId === contribution.actorId);
  const draftingContribution = legacyContribution ?? (creation ? {
    actorId: creation.payload.drafted_by_actor_id ?? creation.payload.producer_actor_id ?? claim.createdBy,
    signedBy: creation.payload.publisher_actor_id ?? creation.payload.signer_actor_id ?? null,
  } : null);
  const drafter = draftingContribution?.actorId ?? currentRevision.createdBy ?? claim.createdBy ?? null;
  const signer = draftingContribution?.signedBy ?? null;

  /* Responses that name this claim, newest revision per object. */
  const responseMap = new Map();
  for (const event of events) {
    const kind = event.payload?.entity_type;
    if (!RESPONSE_KINDS.has(kind) || event.payload?.entity_id === claim.claimId) continue;
    const row = responseFromEvent(event);
    const previous = responseMap.get(row.id);
    if (!previous || previous.revision <= row.revision) responseMap.set(row.id, row);
  }
  const responses = [...responseMap.values()].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));

  const graphNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const graphEntries = graphNodes.map((node) => ({
    id: node.nodeId ?? node.objectId ?? node.claimId ?? node.id,
    type: node.nodeType ?? node.objectType ?? node.kind ?? node.type ?? 'claim',
    label: node.title ?? node.statement ?? node.label ?? node.nodeId ?? node.objectId ?? node.claimId ?? node.id,
    revision: node.nodeRevision ?? node.revision ?? node.revisionNumber,
    state: node.state ?? node.status,
    depth: node.depth,
    direction: node.direction,
  })).filter((node) => typeof node.id === 'string' && node.id !== claim.claimId);
  const graphDepthById = new Map([[claim.claimId, 0], ...graphEntries.map(({ id, depth }) => [id, depth])]);
  const graphRelations = Array.isArray(graph?.edges) ? graph.edges : [];
  const dagEdges = graphRelations.length > 0 ? graphRelations.map((edge, index) => {
    const source = edge.sourceNodeId ?? edge.sourceObjectId ?? edge.sourceClaimId ?? edge.source;
    const target = edge.targetNodeId ?? edge.targetObjectId ?? edge.targetClaimId ?? edge.target;
    return {
      id: edge.edgeId ?? edge.id ?? `${direction}-${source}-${target}-${edge.relationType ?? index}`,
      /* Reader direction changes traversal, never protocol source/target. */
      source,
      target,
      ...(direction === 'both' ? { layoutSource: source, layoutTarget: target } : claimLayoutEndpoints({ source, target, sourceDepth: graphDepthById.get(source), targetDepth: graphDepthById.get(target), direction })),
      relation: edge.relationType ?? edge.relation ?? 'depends_on',
    };
  }) : graphEntries.map(({ id, depth }) => {
    const source = direction === 'upstream' ? id : claim.claimId;
    const target = direction === 'upstream' ? claim.claimId : id;
    return { id: `${direction}-${id}`, source, target, ...(direction === 'both' ? { layoutSource: source, layoutTarget: target } : claimLayoutEndpoints({ source, target, sourceDepth: graphDepthById.get(source) ?? depth, targetDepth: graphDepthById.get(target) ?? depth, direction })), relation: 'depends_on' };
  });
  const legacyGraph = {
    complete: graph?.complete === true,
    nodes: [{ id: claim.claimId, type: 'claim', label: currentRevision.statement ?? claim.claimId, revision: currentRevision.revision, state: claim.state, depth: 0 }, ...graphEntries],
    edges: dagEdges,
  };
  const dagGraph = (neighborhood?.nodes?.length ?? 0) > legacyGraph.nodes.length ? neighborhood : legacyGraph;
  const graphTruncated = Boolean(graph?.truncated || neighborhood?.truncated);

  const evidenceFor = (relation) => evidence.filter((item) => evidenceRelations(item).includes(relation));
  const projectId = claim.projectId ?? question?.projectId ?? frontierMembership?.projectId ?? null;
  const revised = Boolean(revisionDiff) && !pinned;

  const clauses = [
    { id: 'scope', number: '1', label: 'Scope' },
    { id: 'assumptions', number: '2', label: 'Assumptions' },
    { id: 'falsification', number: '3', label: 'Falsification' },
    { id: 'responses', number: '4', label: 'Responses', count: responses.length },
    { id: 'evidence', number: '5', label: 'Evidence', count: evidence.length },
    { id: 'receipts', number: '6', label: 'Receipts', count: receipts.length },
    { id: 'graph', number: '7', label: 'Graph' },
    { id: 'revisions', number: '8', label: 'History' },
    { id: 'technical', number: '9', label: 'Record' },
  ];

  const shareRevision = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/claims/${claim.claimId}?rev=${currentRevision.revision}`);
      setShared(true);
    } catch { /* clipboard unavailable */ }
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <div className="doc-page pb-20 pt-5 sm:pt-6">
      <Breadcrumb
        trail={[
          { label: 'Explore', href: '/explore' },
          ...(claim.questionId ? [{ label: question?.title ?? 'Question', href: `/questions/${claim.questionId}` }] : []),
          { label: `Claim r${currentRevision.revision}` },
        ]}
      />

      <TitleBlock
        cells={[
          { label: 'Revision', bare: true, value: <span className="tabular-nums">r{currentRevision.revision}{latestRevision > 1 ? ` of ${latestRevision}` : ''}{pinned ? ', pinned' : ''}</span> },
          { label: 'Drafted by', value: <ActorName actorId={drafter} /> },
          { label: 'Signed by', value: signer ? <ActorName actorId={signer} showOwner={false} /> : null },
          { label: 'Recorded', bare: true, value: <span className="tabular-nums text-muted-foreground">{formatDate(currentRevision.createdAt)}</span> },
          { label: 'Identifier', bare: true, value: <Identifier value={claim.claimId} /> },
        ]}
        kind="Claim"
        notice={pinned ? (
          <p className="max-w-[68ch] text-sm text-muted-foreground">
            Pinned to r{pinnedRevision}. <Link className="text-primary underline" href={`/claims/${claim.claimId}`}>Current revision</Link>
          </p>
        ) : null}
        serif
        statement={currentRevision.statement}
        status={<StatusBadge state={claim.state} />}
        titleClassName={revised ? 'change-bar' : undefined}
      />

      <ClauseRail clauses={clauses} />

      <div className="doc-grid doc-grid--clauses mt-6">

        <article aria-label="Claim content" className="doc-main">
          <Clause id="scope" number="1" title="Scope">
            <ReadableField value={currentRevision.scope} />
          </Clause>
          <Clause id="assumptions" number="2" title="Assumptions">
            <ReadableField value={currentRevision.assumptions} />
          </Clause>
          <Clause id="falsification" number="3" title="Falsification conditions">
            <ReadableField value={currentRevision.falsification ?? currentRevision.falsificationConditions} />
          </Clause>

          <Clause id="responses" number="4" title="Responses">
            {responses.length === 0 ? (
              <p className="clause__none">None yet.</p>
            ) : (
              <ul>
                {responses.map((row) => (
                  <li className="ref-row" key={row.key}>
                    <div className="flex flex-wrap items-baseline gap-x-2 md:block">
                      {row.kind === 'evaluation' && row.stance
                        ? <StatusBadge state={row.stance} />
                        : <Badge variant={row.kind === 'rebuttal' ? 'status-warning' : 'status-neutral'}>{readable(row.kind)}</Badge>}
                    </div>
                    <div className="min-w-0">
                      <Link className="ref-row__title hover:underline" href={hrefFor(row.kind, row.id)}>{row.title ?? `${readable(row.kind)} ${row.id}`}</Link>
                      {row.body ? <p className="mt-0.5 max-w-[64ch] text-sm leading-6 text-muted-foreground">{row.body}</p> : null}
                      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                        <span>Drafted by</span><ActorName actorId={row.drafter} showOwner={false} />
                        {row.signer && row.signer !== row.drafter ? <><span aria-hidden="true">·</span><span>signed by</span><ActorName actorId={row.signer} showOwner={false} /></> : null}
                      </p>
                    </div>
                    <RefMeta date={formatDate(row.createdAt)} href={hrefFor(row.kind, row.id)} id={row.id} revision={row.revision} />
                  </li>
                ))}
              </ul>
            )}
          </Clause>

          <Clause id="evidence" number="5" title="Evidence by relation">
            {pinned ? <p className="mb-3 text-[13px] text-muted-foreground">Listed claim-wide; each item names its revision.</p> : null}
            {evidence.length === 0 ? (
              <p className="clause__none">None yet.</p>
            ) : RELATIONS.filter((relation) => evidenceFor(relation).length > 0).map((relation) => (
              <div className="clause__group" key={relation}>
                <h3><StatusBadge state={relation} /><span className="font-normal tabular-nums text-muted-foreground">{evidenceFor(relation).length}</span></h3>
                <ul>
                  {evidenceFor(relation).map((item) => (
                    <li className="ref-row" key={`${relation}-${item.evidenceId}`}>
                      <p className="text-sm text-muted-foreground">{readable(item.evidenceType ?? 'evidence')}</p>
                      <div className="min-w-0">
                        <Link className="ref-row__title hover:underline" href={`/evidence/${item.evidenceId}`}>{item.description ?? item.title ?? 'Evidence record'}</Link>
                        <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-xs text-muted-foreground">
                          {item.artifactId ? <span>artifact {item.artifactId}</span> : null}
                          {item.runId ? <span>run {item.runId}</span> : null}
                        </p>
                      </div>
                      <RefMeta date={formatDate(item.createdAt)} href={`/evidence/${item.evidenceId}`} id={item.evidenceId} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Clause>

          <Clause id="receipts" number="6" title="Verification receipts">
            {receipts.length === 0 ? (
              <p className="clause__none">None yet.</p>
            ) : (
              <ul>
                {receipts.slice(0, 10).map((receipt) => (
                  <li className="ref-row" key={receipt.receiptId}>
                    <div><StatusBadge state={receipt.outcome} /></div>
                    <div className="min-w-0">
                      <dl className="grid gap-x-5 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                        {receipt.verificationTypes ? <><dt className="text-muted-foreground">Verification</dt><dd>{receipt.verificationTypes.map(readable).join(', ')}</dd></> : null}
                        {receipt.contextMode ? <><dt className="text-muted-foreground">Context</dt><dd>{readable(receipt.contextMode)}</dd></> : null}
                        {receipt.implementationRelation ? <><dt className="text-muted-foreground">Implementation</dt><dd>{readable(receipt.implementationRelation)}</dd></> : null}
                        {receipt.dataRelation ? <><dt className="text-muted-foreground">Data</dt><dd>{readable(receipt.dataRelation)}</dd></> : null}
                        {receipt.modelFamily ? <><dt className="text-muted-foreground">Model family</dt><dd className="font-mono text-xs">{receipt.modelFamily}</dd></> : null}
                        {typeof receipt.sawExpectedOutputs === 'boolean' ? <><dt className="text-muted-foreground">Expected outputs</dt><dd>{receipt.sawExpectedOutputs ? 'verifier saw expected outputs' : 'blind: expected outputs not shown'}</dd></> : null}
                      </dl>
                      {(receipt.findings ?? []).length > 0 ? (
                        <ul className="mt-3 border-t border-border">
                          {receipt.findings.map((finding, index) => (
                            <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border py-2 text-sm" key={`${receipt.receiptId}-finding-${index}`}>
                              <Badge variant={finding.severity === 'critical' ? 'emphasis-danger' : 'status-warning'}>{finding.severity}</Badge>
                              <span className="font-mono text-xs">{finding.code}</span>
                              <span className="min-w-0 flex-1 text-muted-foreground">{finding.summary ?? finding.detail ?? finding.message ?? 'Recorded on the receipt'}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <RefMeta date={formatDate(receipt.createdAt)} href={`/verifications/${receipt.receiptId}`} id={receipt.receiptId} />
                  </li>
                ))}
              </ul>
            )}
            {receipts.length > 10 ? <p className="mt-3 text-sm text-muted-foreground">Showing the newest 10 of {receipts.length} receipts.</p> : null}
          </Clause>
        </article>

        <aside aria-label="Revision ledger and provenance" className="doc-margin">
          <MarginSection title="Revisions">
            {revisionList && revisionList.length > 0 ? (
              <ol className="ledger">
                {revisionList.map((row) => (
                  <li aria-current={row.revision === currentRevision.revision ? 'true' : undefined} key={row.revision}>
                    <Link className="font-mono tabular-nums hover:underline" href={`/claims/${claim.claimId}?rev=${row.revision}`}>r{row.revision}</Link>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="tabular-nums text-muted-foreground">{formatDate(row.createdAt) ?? 'date not stated'}</span>
                        {row.revision === latestRevision ? <span className="text-xs font-medium text-primary">current</span> : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <Skeleton className="h-6 w-full" />}
            {latestRevision > 8 ? <p className="mt-1 text-xs text-muted-foreground">Newest 8 of {latestRevision}</p> : null}
          </MarginSection>

          <MarginSection title="Continue">
            <Button className="w-full" onClick={() => setHandoffOpen(true)} size="sm" variant="outline">Continue with an agent</Button>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
              <button
                aria-pressed={watched}
                className={cn('inline-flex items-center gap-1.5 hover:underline disabled:cursor-not-allowed disabled:opacity-50', watched ? 'text-primary' : 'text-foreground')}
                disabled={!claimId || !interactionsReady || interactions === null}
                onClick={() => toggleInteraction('claim', claimId, 'watch')}
                title={interactionsReady && interactions === null ? 'Sign in to watch' : undefined}
                type="button"
              >
                {watched ? 'Watching' : 'Watch'}
              </button>
              <button className="inline-flex items-center gap-1.5 text-foreground hover:underline" onClick={shareRevision} type="button">
                {shared ? 'Link copied' : 'Copy permalink'}
              </button>
            </div>
          </MarginSection>

          {!frontierMembership ? (
            <MarginSection title="Frontier membership">
              <p className="text-[13px] text-muted-foreground">Not in the latest snapshot</p>
            </MarginSection>
          ) : null}
          {frontierMembership ? (
            <MarginSection title="Frontier membership">
              <p className="text-[13px] tabular-nums">{projectId ? <Link className="text-primary hover:underline" href={`/projects/${projectId}`}>Snapshot #{frontierMembership.sequence}</Link> : <>Snapshot #{frontierMembership.sequence}</>} at r{frontierMembership.revision}</p>
            </MarginSection>
          ) : null}

          <MarginSection title="Record">
            {/* Challenges track on the claim record; every response is a signed Event. */}
            <Link className="text-[13px] text-primary hover:underline" href={`/events?objectType=claim&objectId=${claim.claimId}`}>Event audit</Link>
          </MarginSection>
        </aside>

        <section aria-label="Research neighborhood" className="doc-span">
          <Clause id="graph" number="7" title="Research graph" wide>
            {graphTruncated ? <Alert className="mb-3" description="This bounded neighborhood reached a server read ceiling. Topology remains unknown wherever hidden connections may exist." title="Neighborhood truncated" variant="warning" /> : null}
            <ClaimDag direction={direction} focusId={claim.claimId} graph={dagGraph} onDirectionChange={setDirection} />
          </Clause>
        </section>

        <div className="doc-after">
          <Clause id="revisions" number="8" title="Revision history">
            {revisionDiff ? (
              <div className="mb-4 grid gap-2 border-b border-border pb-4">
                <p className="text-sm font-medium">Statement, r{revisionDiff.previous} to r{latestRevision}</p>
                <p className="font-serif text-base leading-7 text-muted-foreground line-through decoration-1">{revisionDiff.from}</p>
                <p className="change-bar ml-4 font-serif text-base leading-7">{revisionDiff.to}</p>
              </div>
            ) : null}
            <p className="text-sm">
              <Link className="text-primary hover:underline" href={`/claims/${claim.claimId}/diff`}>Compare revisions</Link>
            </p>
          </Clause>

          <Clause id="technical" number="9" title="Record details">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
              <dt className="text-muted-foreground">Stable id</dt><dd className="break-all font-mono text-xs">{claim.claimId}</dd>
              <dt className="text-muted-foreground">Rendered revision</dt><dd className="font-mono text-xs">r{currentRevision.revision}</dd>
              <dt className="text-muted-foreground">Next allowed states</dt><dd>{statusPolicy.allowedTransitions.map(readable).join(', ') || 'No transitions'}</dd>
              <dt className="text-muted-foreground">Creation event</dt><dd className="break-all font-mono text-xs">{creation ? <Link className="hover:text-primary hover:underline" href={`/events?objectType=claim&objectId=${claim.claimId}`}>{creation.eventId}</Link> : 'via event audit'}</dd>
              <dt className="text-muted-foreground">Event hash</dt><dd className="break-all font-mono text-xs">{creation?.hash ?? data.lastEvent?.hash ?? 'via event audit'}</dd>
              {creation?.payload?.canonical_content_hash ? <><dt className="text-muted-foreground">Content hash</dt><dd className="break-all font-mono text-xs">{creation.payload.canonical_content_hash}</dd></> : null}
              {creation?.payload?.signing_key_id ? <><dt className="text-muted-foreground">Signing key</dt><dd className="break-all font-mono text-xs">{creation.payload.signing_key_id}</dd></> : null}
            </dl>
            <details className="mt-4">
              <summary className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground">Raw fields</summary>
              <div className="mt-3 grid gap-4">
                <div><p className="text-xs text-muted-foreground">scope</p><JsonBlock value={currentRevision.scope} /></div>
                <div><p className="text-xs text-muted-foreground">assumptions</p><JsonBlock value={currentRevision.assumptions} /></div>
                <div><p className="text-xs text-muted-foreground">falsification</p><JsonBlock value={currentRevision.falsification ?? currentRevision.falsificationConditions} /></div>
              </div>
            </details>
          </Clause>
        </div>
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
    </div>
  );
}

function ClaimSkeleton() {
  return (
    <div className="doc-page pb-20 pt-8">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-5 h-56 w-full" />
      <div className="doc-grid mt-10"><Skeleton className="h-96 w-full" /><Skeleton className="h-64 w-full" /></div>
    </div>
  );
}

export default function ClaimDetailPage(props) {
  return (<Suspense fallback={<ClaimSkeleton />}><ClaimDetailView {...props} /></Suspense>);
}
