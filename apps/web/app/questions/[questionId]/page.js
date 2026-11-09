'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClaimDag } from '@/components/claim-dag';
import { HandoffSheet } from '@/components/handoff-sheet';
import { Badge, StatusBadge } from '@/components/ui/data';
import { Button } from '@/components/ui/button';
import { Alert, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Breadcrumb } from '@/components/ui/page';
import {
  ActorName, Clause, ClauseRail, Identifier, MarginSection, ProseList, TitleBlock, formatDate, formatDateTime, shortId,
} from '@/components/ui/doc';
import { hydrateEvidenceLinks, hydrateReceiptFindings, evidenceRelations } from '@/lib/hydrate';
import { RESEARCH_NODE_DEFINITIONS } from '@/lib/research-neighborhood.mjs';
import { useVisitRecord } from '@/lib/visit-history';
import { recordView, useMyInteractions } from '@/lib/interactions';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

const RELATIONS = ['supports', 'refutes', 'qualifies', 'reproduces'];
const ATTENTION_STATES = new Set(['contested', 'refuted', 'retracted', 'dependency_tainted']);

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? 'Question data is unavailable.');
  return body;
}

function readable(value) {
  return String(value ?? '').replaceAll('_', ' ');
}

function hrefFor(kind, id) {
  const prefix = RESEARCH_NODE_DEFINITIONS[kind]?.hrefPrefix;
  return prefix ? `${prefix}/${encodeURIComponent(id)}` : `/events?objectId=${encodeURIComponent(id)}`;
}

function JsonBlock({ value }) {
  return <pre className="mt-2 overflow-x-auto border border-border bg-muted p-3 font-mono text-xs leading-6">{JSON.stringify(value ?? null, null, 2)}</pre>;
}

/* Contract fields are jsonb: strings read as prose, arrays as a ruled list. */
function ContractValue({ value }) {
  if (Array.isArray(value)) return <ProseList items={value} empty="None stated." />;
  if (value && typeof value === 'object') {
    return <ProseList items={Object.entries(value).map(([key, entry]) => `${key}: ${typeof entry === 'string' ? entry : JSON.stringify(entry)}`)} empty="None stated." />;
  }
  return <span className="font-serif leading-7">{String(value)}</span>;
}

function RefMeta({ date, id, revision }) {
  return (
    <div className="text-xs text-muted-foreground md:text-right">
      {date ? <span className="tabular-nums" title={id}>{date}</span> : null}
      {revision ? <span className="ml-2 font-mono">r{revision}</span> : null}
    </div>
  );
}

function None() {
  return <p className="clause__none">None yet.</p>;
}

function hasValue(value) {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/*
 * Question workspace in the research-record grammar (the Claim page is the
 * yardstick): title and byline, an inline section index, sections on
 * hairlines and a margin ledger. Claims form a DAG, never a tree; counts are
 * entry points into exact linked records.
 */
export default function QuestionDetailPage({ params }) {
  const [questionId, setQuestionId] = useState(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [previousSnapshot, setPreviousSnapshot] = useState(null);
  const [sharedRev, setSharedRev] = useState(null);
  const [data, setData] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [receipts, setReceipts] = useState(null);
  const [taskTitles, setTaskTitles] = useState(null);
  const [claimStatements, setClaimStatements] = useState(null);
  const [error, setError] = useState(null);
  const { mine: interactions, ready: interactionsReady, has: hasInteraction, toggle: toggleInteraction } = useMyInteractions();
  const watched = hasInteraction('question', questionId, 'watch');

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
      const [taskItems, frontier, claimItems, events, project, neighborhood] = await Promise.all([
        request(`/tasks?projectId=${projectId}&limit=100`).then((body) => body.items ?? []),
        request(`/projects/${projectId}/frontier/latest`).then((body) => body.frontier ?? null).catch(() => null),
        fetchAllClaims(projectId).catch(() => []),
        /* Signed creation Event: drafter, human signer, key and content hash;
         * typed answers that name this question arrive on the same stream. */
        request(`/events?objectType=question&objectId=${questionId}&limit=20`).then((body) => body.items ?? []).catch(() => []),
        request(`/projects/${projectId}`).then((body) => ({ name: body.currentRevision?.name ?? body.project?.name ?? null })).catch(() => null),
        request(`/research-graph/question/${encodeURIComponent(questionId)}/neighborhood?direction=both&depth=3`).catch(() => null),
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
      setData({
        ...question,
        tasks,
        frontier: frontierWithMembers,
        claims,
        events,
        project,
        neighborhood: neighborhood?.nodes ? neighborhood : null,
      });
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
  /* Local recently-visited rail on Home records this page once its title is known. */
  useVisitRecord({ href: questionId ? `/questions/${questionId}` : null, label: data?.currentRevision?.title ?? null, kind: 'question' });
  /* Best-effort view signal for the personal recommender (once per session). */
  useEffect(() => { if (questionId) recordView('question', questionId); }, [questionId]);

  /* Evidence and receipts load once the question resolves. They cover every
   * claim of this question (up to the list ceiling of 100 per claim). */
  const claimIds = (data?.claims ?? []).map((claim) => claim.claimId);
  useEffect(() => {
    if (evidence !== null || !data) return;
    setEvidence('loading');
    Promise.all(claimIds.map((id) => request(`/evidence?claimId=${id}&limit=100`).then((body) => body.items ?? []).catch(() => [])))
      .then((groups) => hydrateEvidenceLinks(API, groups.flat()))
      .then(setEvidence)
      .catch(() => setEvidence([]));
  }, [data, evidence, claimIds.join(',')]);

  useEffect(() => {
    if (receipts !== null || !data) return;
    setReceipts('loading');
    Promise.all(claimIds.map((id) => request(`/claims/${id}/verifications`).then((body) => (body.items ?? body.receipts ?? []).map((receipt) => ({ claimId: id, ...receipt }))).catch(() => [])))
      .then((groups) => hydrateReceiptFindings(API, groups.flat()))
      .then(setReceipts)
      .catch(() => setReceipts([]));
  }, [data, receipts, claimIds.join(',')]);

  /* Task rows read their titles: task titles live on the revision, so the
   * first six task ids get one bounded detail read. */
  const summaryTaskIds = (data?.tasks ?? []).slice(0, 6).map((task) => task.taskId);
  useEffect(() => {
    if (taskTitles !== null || summaryTaskIds.length === 0) return;
    Promise.all(summaryTaskIds.map(async (taskId) => {
      try {
        const detail = await request(`/tasks/${taskId}`);
        return [taskId, detail.currentRevision?.title ?? null];
      } catch {
        return [taskId, null];
      }
    })).then((entries) => setTaskTitles(Object.fromEntries(entries)));
  }, [taskTitles, summaryTaskIds.join(',')]);

  /* Claim rows read their statements: statements live on the claim detail
   * endpoint; the first ten get one bounded read each. */
  const argumentClaimIds = (data?.claims ?? []).slice(0, 10).map((claim) => claim.claimId);
  useEffect(() => {
    if (claimStatements !== null || argumentClaimIds.length === 0) return;
    Promise.all(argumentClaimIds.map(async (claimId) => {
      try {
        const detail = await request(`/claims/${claimId}`);
        const statement = detail.currentRevision?.statement ?? null;
        return [claimId, statement ? `${String(statement).slice(0, 220)}${statement.length > 220 ? '…' : ''}` : null];
      } catch {
        return [claimId, null];
      }
    })).then((entries) => setClaimStatements(Object.fromEntries(entries)));
  }, [claimStatements, argumentClaimIds.join(',')]);
  useEffect(() => {
    const label = data?.currentRevision?.title ?? '';
    document.title = label ? `${String(label).slice(0, 48)} · EviMesh` : 'EviMesh';
  }, [data]);

  if (error) return <div className="doc-page pb-20 pt-10"><ErrorState message={error} onRetry={load} /></div>;
  if (!data) return <QuestionSkeleton />;

  const { question, currentRevision, contract, tasks, frontier, claims, events, project, neighborhood } = data;
  const latestRevision = currentRevision.revision ?? 1;
  /* Scope fields live on the contract revision (research_contract_revisions),
   * not the question revision; read both with the contract winning. */
  const scopeSource = { ...currentRevision, ...Object.fromEntries(
    Object.entries(contract ?? {}).filter(([key]) => ['problem', 'scope', 'exclusions', 'falsification', 'acceptableEvidence'].includes(key)),
  ) };

  /* Attribution chain from the signed creation Event. An Agent is never
   * shown as the signer. */
  const creation = events.find((event) => event.eventType === 'question.created' && (event.payload?.entity_id ?? event.payload?.question_id) === question.questionId) ?? null;
  const drafter = creation?.payload?.drafted_by_actor_id ?? creation?.payload?.producer_actor_id ?? currentRevision.createdBy ?? question.createdBy ?? null;
  const signer = creation?.payload?.publisher_actor_id ?? creation?.payload?.signer_actor_id ?? null;

  /* Revision ledger from this question's own signed Events, newest first. */
  const revisionMap = new Map();
  for (const event of events) {
    const payload = event.payload ?? {};
    if ((payload.entity_id ?? payload.question_id) !== question.questionId || !Number.isInteger(payload.revision)) continue;
    if (!revisionMap.has(payload.revision)) {
      revisionMap.set(payload.revision, { revision: payload.revision, createdAt: event.createdAt ?? null, createdBy: payload.drafted_by_actor_id ?? payload.actor_id ?? null });
    }
  }
  if (!revisionMap.has(latestRevision)) revisionMap.set(latestRevision, { revision: latestRevision, createdAt: currentRevision.createdAt ?? null, createdBy: currentRevision.createdBy ?? null });
  const revisionList = [...revisionMap.values()].sort((left, right) => right.revision - left.revision).slice(0, 8);
  const pinnedOther = Number.isInteger(sharedRev) && sharedRev >= 1 && sharedRev !== latestRevision;

  /* Answers that name this question: signed answer Events first (they carry
   * both actors), then any answer nodes in the typed neighborhood. */
  const answerMap = new Map();
  for (const event of events) {
    const payload = event.payload ?? {};
    if (payload.entity_type !== 'answer' || !payload.entity_id) continue;
    const doc = payload.typed_document ?? {};
    const revision = payload.revision ?? doc.revision ?? 1;
    const previous = answerMap.get(payload.entity_id);
    if (previous && previous.revision > revision) continue;
    answerMap.set(payload.entity_id, {
      id: payload.entity_id,
      revision,
      title: doc.title ?? doc.synthesis ?? null,
      body: doc.title ? (doc.synthesis ?? null) : (doc.limitations ? `Limitations: ${Array.isArray(doc.limitations) ? doc.limitations.join('; ') : doc.limitations}` : null),
      drafter: payload.drafted_by_actor_id ?? payload.producer_actor_id ?? payload.actor_id ?? null,
      signer: payload.publisher_actor_id ?? payload.signer_actor_id ?? null,
      state: doc.state ?? null,
      createdAt: event.createdAt ?? null,
    });
  }
  for (const node of neighborhood?.nodes ?? []) {
    if (node.ref?.kind !== 'answer' || answerMap.has(node.ref.id)) continue;
    answerMap.set(node.ref.id, { id: node.ref.id, revision: node.ref.revision ?? null, title: node.label ?? null, body: null, drafter: node.createdBy ?? null, signer: null, state: node.state ?? null, createdAt: node.createdAt ?? null });
  }
  const answers = [...answerMap.values()].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));

  const attentionClaims = claims.filter((claim) => ATTENTION_STATES.has(claim.state));
  const attentionClaimIds = new Set(attentionClaims.map((claim) => claim.claimId));
  const frontierMembers = Array.isArray(frontier?.members) ? frontier.members : [];
  /* Frontier contamination: member claims whose current state is
   * dependency_tainted poison the snapshot's usage premises. */
  const taintedFrontierMembers = frontierMembers.filter((member) => (claims.find((entry) => entry.claimId === member.claimId) ?? {}).state === 'dependency_tainted');

  const receiptRows = Array.isArray(receipts) ? receipts : [];
  const evidenceRows = Array.isArray(evidence) ? evidence : [];
  /* Disputes and verification blocks: major or critical findings on the
   * receipts of attention claims, bounded. Not a verdict on the question. */
  const attentionFindings = [];
  for (const receipt of receiptRows) {
    if (!attentionClaimIds.has(receipt.claimId)) continue;
    for (const finding of receipt.findings ?? []) {
      if (finding.severity === 'critical' || finding.severity === 'major') attentionFindings.push({ finding, receiptId: receipt.receiptId });
    }
  }
  const evidenceByRelation = (relation) => evidenceRows.filter((item) => evidenceRelations(item).includes(relation));
  const outcomeCount = (outcome) => receiptRows.filter((receipt) => receipt.outcome === outcome).length;
  const topFindingSeverity = receiptRows.reduce((top, receipt) => {
    for (const finding of receipt.findings ?? []) {
      if (finding.severity === 'critical') return 'critical';
      if (finding.severity === 'major' && top !== 'critical') top = 'major';
      else if (finding.severity === 'warning' && !top) top = 'warning';
    }
    return top;
  }, null);

  /* The typed neighborhood carries the question's research graph; before
   * any typed edge exists it is the question alone. */
  const dagGraph = neighborhood ?? {
    complete: false,
    focusId: question.questionId,
    nodes: [{ ref: { kind: 'question', id: question.questionId, revision: latestRevision }, label: currentRevision.title ?? question.questionId, family: 'structure', state: question.state, canonicalHref: `/questions/${question.questionId}`, isCurrent: true }],
    edges: [],
  };

  const clauses = [
    { id: 'contract', number: '1', label: 'Scope' },
    { id: 'claims', number: '2', label: 'Claims', count: claims.length },
    { id: 'answers', number: '3', label: 'Answers', count: answers.length },
    { id: 'tasks', number: '4', label: 'Tasks', count: tasks.length },
    { id: 'evidence', number: '5', label: 'Evidence', count: evidence === null || evidence === 'loading' ? undefined : evidenceRows.length },
    { id: 'receipts', number: '6', label: 'Receipts', count: receipts === null || receipts === 'loading' ? undefined : receiptRows.length },
    { id: 'frontier', number: '7', label: 'Frontier' },
    { id: 'graph', number: '8', label: 'Graph' },
    { id: 'revisions', number: '9', label: 'History' },
    { id: 'technical', number: '10', label: 'Record' },
  ];

  const shareSnapshot = async () => {
    try {
      const shareContext = new URL(window.location.href);
      shareContext.searchParams.set('rev', String(latestRevision));
      shareContext.hash = '';
      await navigator.clipboard.writeText(shareContext.href);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* unavailable */ }
  };

  const projectLabel = project?.name ?? 'Project';

  return (
    <div className="doc-page pb-20 pt-5 sm:pt-6">
      <Breadcrumb
        trail={[
          { label: 'Explore', href: '/explore' },
          { label: projectLabel, href: `/projects/${question.projectId}` },
          { label: `Question r${latestRevision}` },
        ]}
      />

      <TitleBlock
        cells={[
          { label: 'Revision', bare: true, value: <span className="tabular-nums">r{latestRevision}{pinnedOther ? `, shared at r${sharedRev}` : ''}</span> },
          { label: 'Project', bare: true, value: <Link className="hover:underline" href={`/projects/${question.projectId}`}>{project?.name ?? shortId(question.projectId)}</Link> },
          { label: 'Drafted by', value: <ActorName actorId={drafter} /> },
          { label: 'Signed by', value: signer ? <ActorName actorId={signer} showOwner={false} /> : null },
          { label: 'Recorded', bare: true, value: <span className="tabular-nums text-muted-foreground">{formatDate(currentRevision.createdAt)}</span> },
          { label: 'Identifier', bare: true, value: <Identifier value={question.questionId} /> },
        ]}
        kind="Question"
        notice={(
          <>
            {currentRevision.statement ? <p className="max-w-[68ch] font-serif text-base leading-7 text-muted-foreground">{currentRevision.statement}</p> : null}
            {taintedFrontierMembers.length > 0 ? (
              <Alert
                className="max-w-[68ch]"
                description={`${taintedFrontierMembers.length} frontier member claim${taintedFrontierMembers.length === 1 ? ' is' : 's are'} dependency-tainted.`}
                title="Frontier contamination"
                variant="destructive"
              />
            ) : null}
          </>
        )}
        serif
        status={<StatusBadge state={question.state} />}
        title={currentRevision.title ?? question.questionId}
      />

      <ClauseRail clauses={clauses} />

      <div className="doc-grid doc-grid--clauses mt-6">

        <article aria-label="Question content" className="doc-main">
          <Clause aside={<span className="tabular-nums">Contract r{contract.revision}</span>} id="contract" number="1" title="Research scope">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
              {hasValue(scopeSource.problem) ? (<><dt className="text-muted-foreground">Problem</dt><dd><ContractValue value={scopeSource.problem} /></dd></>) : null}
              {hasValue(scopeSource.scope) ? (<><dt className="text-muted-foreground">Scope</dt><dd><ContractValue value={scopeSource.scope} /></dd></>) : null}
              {hasValue(scopeSource.exclusions) ? (<><dt className="text-muted-foreground">Exclusions</dt><dd><ContractValue value={scopeSource.exclusions} /></dd></>) : null}
              {hasValue(scopeSource.falsification) ? (<><dt className="text-muted-foreground">Falsification</dt><dd><ContractValue value={scopeSource.falsification} /></dd></>) : null}
              {hasValue(scopeSource.acceptableEvidence) ? (<><dt className="text-muted-foreground">Acceptance</dt><dd><ContractValue value={scopeSource.acceptableEvidence} /></dd></>) : null}
              <dt className="text-muted-foreground">Contract</dt><dd><Identifier revision={contract.revision} value={contract.contractId} /></dd>
            </dl>
          </Clause>

          <Clause aside={<span className="tabular-nums">{claims.length}</span>} id="claims" number="2" title="Claims">
            {attentionClaims.length > 0 || attentionFindings.length > 0 ? (
              <div className="clause__group mb-4">
                <h3>Disputes and verification blocks</h3>
                <ul>
                  {attentionClaims.map((claim) => (
                    <li className="ref-row" key={`attention-${claim.claimId}`}>
                      <div><StatusBadge state={claim.state} /></div>
                      <div className="min-w-0">
                        <Link className="ref-row__title hover:underline" href={`/claims/${claim.claimId}`}>{claimStatements?.[claim.claimId] ?? `Claim ${shortId(claim.claimId)}`}</Link>
                      </div>
                      <RefMeta date={formatDate(claim.updatedAt ?? claim.createdAt)} id={claim.claimId} />
                    </li>
                  ))}
                  {receipts === 'loading' && attentionClaims.length > 0 ? <li className="border-b border-border py-3 text-sm text-muted-foreground">Reading receipt findings…</li> : null}
                  {attentionFindings.slice(0, 10).map(({ finding, receiptId }, index) => (
                    <li className="ref-row" key={`${receiptId}-${finding.code}-${index}`}>
                      <div><Badge variant={finding.severity === 'critical' ? 'emphasis-danger' : 'status-warning'}>{finding.severity}</Badge></div>
                      <div className="min-w-0 text-sm">
                        <Link className="font-mono text-xs hover:underline" href={`/verifications/${receiptId}`}>{finding.code}</Link>
                        <span className="ml-2 text-muted-foreground">{finding.summary ?? finding.detail ?? finding.message ?? 'Recorded on the receipt'}</span>
                      </div>
                      <RefMeta id={receiptId} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {claims.length === 0 ? <None /> : (
              <ul>
                {claims.map((claim) => (
                  <li className="ref-row" key={claim.claimId}>
                    <div><StatusBadge state={claim.state} /></div>
                    <div className="min-w-0">
                      <Link className="ref-row__title hover:underline" href={`/claims/${claim.claimId}`}>{claimStatements?.[claim.claimId] ?? `Claim ${shortId(claim.claimId)}`}</Link>
                      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                        <span>Drafted by</span><ActorName actorId={claim.createdBy} showOwner={false} />
                      </p>
                    </div>
                    <RefMeta date={formatDate(claim.createdAt)} id={claim.claimId} />
                  </li>
                ))}
              </ul>
            )}
          </Clause>

          <Clause aside={<span className="tabular-nums">{answers.length}</span>} id="answers" number="3" title="Answers">
            {answers.length === 0 ? <None /> : (
              <ul>
                {answers.map((row) => (
                  <li className="ref-row" key={row.id}>
                    <div>{row.state ? <StatusBadge state={row.state} /> : <p className="text-sm text-muted-foreground">Answer</p>}</div>
                    <div className="min-w-0">
                      <Link className="ref-row__title hover:underline" href={hrefFor('answer', row.id)}>{row.title ?? `Answer ${shortId(row.id)}`}</Link>
                      {row.body ? <p className="mt-0.5 max-w-[64ch] text-sm leading-6 text-muted-foreground">{row.body}</p> : null}
                      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                        <span>Drafted by</span><ActorName actorId={row.drafter} showOwner={false} />
                        {row.signer && row.signer !== row.drafter ? <><span aria-hidden="true">·</span><span>signed by</span><ActorName actorId={row.signer} showOwner={false} /></> : null}
                      </p>
                    </div>
                    <RefMeta date={formatDate(row.createdAt)} id={row.id} revision={row.revision} />
                  </li>
                ))}
              </ul>
            )}
          </Clause>

          <Clause aside={<span className="tabular-nums">{tasks.length}</span>} id="tasks" number="4" title="Tasks">
            {tasks.length === 0 ? <None /> : (
              <ul>
                {tasks.slice(0, 6).map((task) => (
                  <li className="ref-row" key={task.taskId}>
                    <div><StatusBadge state={task.status ?? task.state ?? 'open'} /></div>
                    <div className="min-w-0">
                      <Link className="text-sm font-medium hover:underline" href={`/tasks/${task.taskId}`}>{taskTitles?.[task.taskId] ?? `Task ${shortId(task.taskId)}`}</Link>
                    </div>
                    <RefMeta date={formatDate(task.createdAt)} id={task.taskId} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
              {tasks.length > 6 ? <span className="text-muted-foreground">6 of {tasks.length}</span> : null}
              <Link className="text-primary hover:underline" href="/work">Open in Work</Link>
            </p>
          </Clause>

          <Clause aside={evidence === null || evidence === 'loading' ? null : <span className="tabular-nums">{evidenceRows.length}</span>} id="evidence" number="5" title="Evidence by relation">
            {evidence === null || evidence === 'loading' ? <Skeleton className="h-32 w-full" /> : evidenceRows.length === 0 ? (
              <None />
            ) : RELATIONS.filter((relation) => evidenceByRelation(relation).length > 0).map((relation) => {
              const items = evidenceByRelation(relation);
              return (
                <div className="clause__group" key={relation}>
                  <h3><StatusBadge state={relation} /><span className="font-normal tabular-nums text-muted-foreground">{items.length}</span></h3>
                  <ul>
                    {items.slice(0, 5).map((item) => (
                      <li className="ref-row" key={`${relation}-${item.evidenceId}`}>
                        <p className="text-sm text-muted-foreground">{readable(item.evidenceType ?? 'evidence')}</p>
                        <div className="min-w-0">
                          <Link className="ref-row__title hover:underline" href={`/evidence/${item.evidenceId}`}>{item.description ?? item.title ?? 'Evidence record'}</Link>
                          {(item.artifactId || item.runId) ? (
                            <p className="mt-1 font-mono text-xs text-muted-foreground" title={[item.artifactId, item.runId].filter(Boolean).join(' ')}>
                              {item.artifactId ? `artifact ${item.artifactId}` : ''}{item.artifactId && item.runId ? ' · ' : ''}{item.runId ? `run ${item.runId}` : ''}
                            </p>
                          ) : null}
                        </div>
                        <RefMeta date={formatDate(item.createdAt)} id={item.evidenceId} />
                      </li>
                    ))}
                  </ul>
                  {items.length > 5 ? <p className="mt-2 text-xs text-muted-foreground">Newest 5 of {items.length}</p> : null}
                </div>
              );
            })}
          </Clause>

          <Clause aside={receipts === null || receipts === 'loading' ? null : <span className="tabular-nums">{receiptRows.length}</span>} id="receipts" number="6" title="Verification receipts">
            {receipts === null || receipts === 'loading' ? <Skeleton className="h-32 w-full" /> : receiptRows.length === 0 ? (
              <None />
            ) : (
              <>
                <p className="mb-2 text-[13px] tabular-nums text-muted-foreground">
                  supports {outcomeCount('supports')}, refutes {outcomeCount('refutes')}, qualifies {outcomeCount('qualifies')}, inconclusive {outcomeCount('inconclusive')}{topFindingSeverity ? `; most severe finding ${topFindingSeverity}` : ''}
                </p>
                <ul>
                  {receiptRows.slice(0, 10).map((receipt) => (
                    <li className="ref-row" key={receipt.receiptId}>
                      <div><StatusBadge state={receipt.outcome} /></div>
                      <div className="min-w-0">
                        <dl className="grid gap-x-5 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                          {receipt.claimId ? <><dt className="text-muted-foreground">Claim</dt><dd><Link className="font-serif hover:underline" href={`/claims/${receipt.claimId}`}>{claimStatements?.[receipt.claimId] ?? shortId(receipt.claimId)}</Link></dd></> : null}
                          {receipt.verificationTypes ? <><dt className="text-muted-foreground">Verification</dt><dd>{receipt.verificationTypes.map(readable).join(', ')}</dd></> : null}
                          {receipt.contextMode ? <><dt className="text-muted-foreground">Context</dt><dd>{readable(receipt.contextMode)}</dd></> : null}
                          {receipt.implementationRelation ? <><dt className="text-muted-foreground">Implementation</dt><dd>{readable(receipt.implementationRelation)}</dd></> : null}
                          {typeof receipt.sawExpectedOutputs === 'boolean' ? <><dt className="text-muted-foreground">Expected outputs</dt><dd>{receipt.sawExpectedOutputs ? 'verifier saw expected outputs' : 'blind: expected outputs not shown'}</dd></> : null}
                        </dl>
                        {(receipt.findings ?? []).length > 0 ? (
                          <ul className="mt-3 border-t border-border">
                            {receipt.findings.map((finding, index) => (
                              <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border py-2 text-sm" key={`${receipt.receiptId}-f-${index}`}>
                                <Badge variant={finding.severity === 'critical' ? 'emphasis-danger' : 'status-warning'}>{finding.severity}</Badge>
                                <span className="font-mono text-xs">{finding.code}</span>
                                <span className="min-w-0 flex-1 text-muted-foreground">{finding.summary ?? finding.detail ?? finding.message ?? 'Recorded on the receipt'}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <Link className="mt-1 inline-block text-xs text-muted-foreground hover:text-primary hover:underline" href={`/verifications/${receipt.receiptId}`}>Receipt {shortId(receipt.receiptId)}</Link>
                      </div>
                      <RefMeta date={formatDate(receipt.createdAt)} id={receipt.receiptId} />
                    </li>
                  ))}
                </ul>
                {receiptRows.length > 10 ? <p className="mt-2 text-xs text-muted-foreground">Newest 10 of {receiptRows.length}</p> : null}
              </>
            )}
          </Clause>

          <Clause aside={frontier ? <span className="tabular-nums">Frontier #{frontier.sequence}</span> : null} id="frontier" number="7" title="Frontier">
            {!frontier ? <p className="clause__none">None published.</p> : frontierMembers.length === 0 ? (
              <p className="clause__none">No members.</p>
            ) : (
              <ul>
                {frontierMembers.map((member) => {
                  const claim = claims.find((entry) => entry.claimId === member.claimId);
                  const revision = member.claimRevision ?? member.revision ?? null;
                  return (
                    <li className="ref-row" key={member.claimId ?? member.id}>
                      <div><StatusBadge state={claim?.state ?? 'accepted'} /></div>
                      <div className="min-w-0">
                        <Link className="ref-row__title hover:underline" href={`/claims/${member.claimId}${revision ? `?rev=${revision}` : ''}`}>{claimStatements?.[member.claimId] ?? `Claim ${shortId(member.claimId)}`}</Link>
                      </div>
                      <RefMeta id={member.claimId} revision={revision} />
                    </li>
                  );
                })}
              </ul>
            )}
            {frontier ? (
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                <Link className="text-primary hover:underline" href={`/projects/${question.projectId}/frontier/${frontier.snapshotId}`}>Snapshot #{frontier.sequence}</Link>
                {previousSnapshot ? <Link className="text-muted-foreground hover:text-foreground hover:underline" href={`/projects/${question.projectId}/frontier/${previousSnapshot.snapshotId}`}>Previous #{previousSnapshot.sequence}</Link> : null}
              </p>
            ) : null}
          </Clause>
        </article>

        <aside aria-label="Revision ledger and follow-up" className="doc-margin">
          <MarginSection title="Revisions">
            <ol className="ledger">
              {revisionList.map((row) => (
                <li aria-current={row.revision === latestRevision ? 'true' : undefined} key={row.revision}>
                  <Link className="font-mono tabular-nums hover:underline" href={`/questions/${question.questionId}?rev=${row.revision}`}>r{row.revision}</Link>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="tabular-nums text-muted-foreground">{formatDate(row.createdAt) ?? 'date not stated'}</span>
                      {row.revision === latestRevision ? <span className="text-xs font-medium text-primary">current</span> : null}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </MarginSection>

          <MarginSection title="Continue">
            <Button className="w-full" onClick={() => setHandoffOpen(true)} size="sm" variant="outline">Continue with an agent</Button>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
              <button
                aria-pressed={watched}
                className={cn('inline-flex items-center gap-1.5 hover:underline disabled:cursor-not-allowed disabled:opacity-50', watched ? 'text-primary' : 'text-foreground')}
                disabled={!questionId || !interactionsReady || interactions === null}
                onClick={() => toggleInteraction('question', questionId, 'watch')}
                title={interactionsReady && interactions === null ? 'Sign in to watch' : undefined}
                type="button"
              >
                {watched ? 'Watching' : 'Watch'}
              </button>
              <button className="inline-flex items-center gap-1.5 text-foreground hover:underline" onClick={shareSnapshot} type="button">
                {shared ? 'Link copied' : 'Copy permalink'}
              </button>
            </div>
          </MarginSection>

          <MarginSection title="Record">
            <Link className="text-[13px] text-primary hover:underline" href={`/events?objectType=question&objectId=${question.questionId}`}>Event audit</Link>
          </MarginSection>
        </aside>

        <section aria-label="Research neighborhood" className="doc-span">
          <Clause id="graph" number="8" title="Research graph" wide>
            {neighborhood?.truncated ? <Alert className="mb-3" description="This bounded neighborhood reached a server read ceiling. Topology remains unknown wherever hidden connections may exist." title="Neighborhood truncated" variant="warning" /> : null}
            <ClaimDag direction="both" focusId={question.questionId} graph={dagGraph} />
          </Clause>
        </section>

        <div className="doc-after">
          <Clause id="revisions" number="9" title="Revision history">
            {events.length === 0 ? <None /> : (
              <ul className="border-t border-border">
                {events.map((event) => (
                  <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border py-2 text-sm" key={event.eventId}>
                    <span className="font-mono text-xs">{event.eventType ?? 'event'}</span>
                    {event.payload?.actor_id ?? event.actorId ? <ActorName actorId={event.payload?.actor_id ?? event.actorId} className="text-xs" showOwner={false} /> : null}
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatDateTime(event.createdAt) ?? ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </Clause>

          <Clause id="technical" number="10" title="Record details">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
              <dt className="text-muted-foreground">Stable id</dt><dd className="break-all font-mono text-xs">{question.questionId}</dd>
              <dt className="text-muted-foreground">Rendered revision</dt><dd className="font-mono text-xs">r{latestRevision}</dd>
              <dt className="text-muted-foreground">Project</dt><dd className="break-all font-mono text-xs">{question.projectId}</dd>
              <dt className="text-muted-foreground">Contract</dt><dd className="break-all font-mono text-xs">{contract.contractId} r{contract.revision}</dd>
              {frontier ? <><dt className="text-muted-foreground">Frontier snapshot</dt><dd className="break-all font-mono text-xs">{frontier.snapshotId}</dd></> : null}
              <dt className="text-muted-foreground">Creation event</dt><dd className="break-all font-mono text-xs">{creation?.eventId ?? 'via event audit'}</dd>
              <dt className="text-muted-foreground">Event hash</dt><dd className="break-all font-mono text-xs">{creation?.hash ?? 'via event audit'}</dd>
              {creation?.payload?.canonical_content_hash ? <><dt className="text-muted-foreground">Content hash</dt><dd className="break-all font-mono text-xs">{creation.payload.canonical_content_hash}</dd></> : null}
              {creation?.payload?.signing_key_id ? <><dt className="text-muted-foreground">Signing key</dt><dd className="break-all font-mono text-xs">{creation.payload.signing_key_id}</dd></> : null}
            </dl>
            <details className="mt-4">
              <summary className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground">Raw contract fields</summary>
              <JsonBlock value={contract} />
            </details>
          </Clause>
        </div>
      </div>

      <HandoffSheet
        cliCommand={`sq question list --project ${question.projectId}   # find this question's state\nsq task list --status open             # open tasks to pick up`}
        intent="Continue this question with your agent"
        mcpCall={`tool:     search_open_tasks (read-only)\nresource: evimesh://projects/${question.projectId}/frontier/latest`}
        objectId={question.questionId}
        objectType="question"
        onOpenChange={setHandoffOpen}
        open={handoffOpen}
        revision={latestRevision}
        scopes={['read', 'drafts']}
        view="workspace"
      />
    </div>
  );
}

function QuestionSkeleton() {
  return (
    <div className="doc-page pb-20 pt-8">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-5 h-56 w-full" />
      <div className="doc-grid mt-10"><Skeleton className="h-96 w-full" /><Skeleton className="h-64 w-full" /></div>
    </div>
  );
}
