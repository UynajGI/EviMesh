import Link from 'next/link';
import { ClaimDag } from '@/components/claim-dag';
import { StatusBadge } from '@/components/ui/data';
import { Breadcrumb } from '@/components/ui/page';
import { ActorName, Clause, ClauseRail, Identifier, MarginSection, TitleBlock } from '@/components/ui/doc';
import { shortId } from '@/lib/short-id.mjs';
import { readResearchNeighborhood } from '@/lib/research-object-data.mjs';
import { RESEARCH_NODE_DEFINITIONS } from '@/lib/research-neighborhood.mjs';

/*
 * Shared typed-object detail (answers, rebuttals, evaluations, datasets,
 * tools, evidence, runs, receipts) in the research-record grammar: title and
 * byline, an inline section index, sections on hairlines and a provenance
 * margin. Server component: client primitives render as elements with
 * serializable props only; dates are formatted inline.
 */

const SERIF_KINDS = new Set(['answer', 'claim', 'question', 'rebuttal', 'evaluation']);
const REF_KINDS_FOR_EVENTS = new Set(['claim', 'question']);
const FIELD_LABELS = Object.freeze({
  targetRef: 'Target',
  subjectRef: 'Subject',
  questionRef: 'Question',
  basisRefs: 'Basis',
  artifactRef: 'Artifact',
  additionalInputs: 'Additional inputs',
  schemaUri: 'Schema URI',
  inputSchemaUri: 'Input schema URI',
  outputSchemaUri: 'Output schema URI',
  toolKind: 'Tool kind',
});

function readable(value, fallback = 'not stated') {
  return String(value ?? fallback).replaceAll('_', ' ');
}

function sentenceCase(value) {
  const text = readable(value, '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function fieldLabel(field) {
  return FIELD_LABELS[field] ?? sentenceCase(field.replaceAll(/([A-Z])/g, ' $1').toLowerCase());
}

function isoDate(value) {
  const stamp = Date.parse(value ?? '');
  return Number.isNaN(stamp) ? null : new Date(stamp).toISOString().slice(0, 10);
}

async function readJson(path) {
  const base = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
  if (!base) return null;
  try {
    const response = await fetch(`${base}${path}`, { cache: 'no-store' });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

function objectFromPayload(payload, type) {
  return payload?.[type] ?? payload?.node ?? payload?.object ?? payload ?? {};
}

function revisionFromPayload(payload, object) {
  const candidates = [
    payload?.typedRevision,
    payload?.revision,
    payload?.currentRevision,
    object.typedRevision,
    object.currentRevision,
    object.revisionData,
  ];
  return candidates.find((candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate)) ?? {};
}

async function readNeighborhood(id, type) {
  const graph = await readResearchNeighborhood(readJson, { kind: type, id, depth: 3, direction: 'both' });
  return graph?.nodes ? graph : null;
}

/* The signed creation Event carries the drafter, the human publisher, the
 * signing key and the canonical content hash. Read it on the object's own
 * stream first; typed responses are indexed on the object they name, so
 * fall back to that object's stream (bounded) and match by entity id. */
function findCreation(items, id) {
  return (items ?? []).find((event) => event.payload?.entity_id === id && /\.created$/.test(event.eventType ?? '')) ?? null;
}

async function readCreationEvent(type, id, refs) {
  const own = await readJson(`/events?objectType=${encodeURIComponent(type)}&objectId=${encodeURIComponent(id)}&order=asc&limit=20`);
  const direct = findCreation(own?.items, id);
  if (direct) return direct;
  for (const ref of refs.slice(0, 2)) {
    const body = await readJson(`/events?objectType=${encodeURIComponent(ref.kind)}&objectId=${encodeURIComponent(ref.id)}&order=asc&limit=100`);
    const match = findCreation(body?.items, id);
    if (match) return match;
  }
  return null;
}

const TYPE_CONTENT_FIELDS = Object.freeze({
  answer: ['synthesis', 'limitations', 'questionRef', 'additionalInputs'],
  rebuttal: ['argument', 'scope', 'targetRef', 'basisRefs'],
  evaluation: ['stance', 'rationale', 'method', 'subjectRef', 'basisRefs'],
  dataset: ['description', 'version', 'license', 'schemaUri', 'provenance', 'artifactRef'],
  tool: ['description', 'toolKind', 'version', 'runtime', 'inputSchemaUri', 'outputSchemaUri', 'license', 'provenance', 'artifactRef'],
});

function isRef(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.kind && value.id);
}

function refHref(ref) {
  const prefix = RESEARCH_NODE_DEFINITIONS[ref.kind]?.hrefPrefix;
  if (!prefix) return null;
  const revision = Number(ref.revision);
  return `${prefix}/${encodeURIComponent(ref.id)}${ref.kind === 'claim' && Number.isInteger(revision) && revision > 0 ? `?rev=${revision}` : ''}`;
}

function researchValue(value) {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) return value.map(researchValue).filter(Boolean).join(' / ');
  if (typeof value === 'object') {
    if (value.kind && value.id) return `${value.kind}:${value.id}${value.revision ? `@r${value.revision}` : ''}`;
    return JSON.stringify(value);
  }
  return String(value);
}

function hasContent(value) {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function contentRows(type, revision, object) {
  const preferred = TYPE_CONTENT_FIELDS[type] ?? ['statement', 'summary', 'description', 'method', 'outcome'];
  return preferred
    .map((field) => ({ field, value: revision[field] ?? object[field] }))
    .filter(({ value }) => hasContent(value));
}

function collectRefs(revision, object) {
  const refs = [];
  for (const field of ['targetRef', 'subjectRef', 'questionRef', 'basisRefs']) {
    const value = revision[field] ?? object[field];
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (isRef(entry) && REF_KINDS_FOR_EVENTS.has(entry.kind) && !refs.some((ref) => ref.id === entry.id)) refs.push(entry);
    }
  }
  return refs;
}

/* A reference names its target in the target's own words when the
 * neighborhood carries them; the id stays available on hover. */
function RefLink({ value, labels }) {
  const href = refHref(value);
  const words = labels?.get(value.id) ?? null;
  const kindRevision = `${sentenceCase(value.kind)}${value.revision ? ` r${value.revision}` : ''}`;
  const body = words
    ? <><span className="font-serif text-base">{words}</span> <span className="whitespace-nowrap text-xs text-muted-foreground">{kindRevision}</span></>
    : <span className="break-all font-mono text-xs">{readable(value.kind)} {value.id}{value.revision ? ` r${value.revision}` : ''}</span>;
  return href
    ? <Link className="hover:text-primary hover:underline" href={href} title={value.id}>{body}</Link>
    : <span>{body}</span>;
}

/* One typed field set as reading prose: refs become links, protocol string
 * lists become a ruled list, scalar text stays serif research words. */
function ContentValue({ field, value, labels }) {
  if (isRef(value)) return <RefLink labels={labels} value={value} />;
  if (Array.isArray(value)) {
    return (
      <ul className="doc-list">
        {value.map((entry, index) => (
          <li key={`${field}-${index}`}>{isRef(entry) ? <RefLink labels={labels} value={entry} /> : <span className="font-serif">{researchValue(entry)}</span>}</li>
        ))}
      </ul>
    );
  }
  if (field === 'stance') return <StatusBadge state={String(value)} />;
  if (/Uri$|^license$|^version$|^runtime$|^toolKind$/.test(field)) return <span className="break-all font-mono text-xs">{researchValue(value)}</span>;
  return <span className="font-serif leading-7">{researchValue(value)}</span>;
}

export async function ResearchObjectDetail({ collection, id, type }) {
  const [payload, graphPayload] = await Promise.all([
    readJson(`/${collection}/${encodeURIComponent(id)}`),
    readNeighborhood(id, type),
  ]);
  const object = objectFromPayload(payload, type);
  const revision = revisionFromPayload(payload, object);
  const creation = await readCreationEvent(type, id, collectRefs(revision, object));
  const typedDocument = creation?.payload?.typed_document ?? {};
  const title = revision.title ?? revision.statement ?? revision.name ?? (type === 'evaluation' ? revision.rationale : null) ?? (type === 'answer' ? revision.synthesis : null) ?? revision.label ?? object.title ?? object.statement ?? object.name ?? object.label ?? typedDocument.title ?? `${sentenceCase(type)} ${id}`;
  const description = revision.summary ?? revision.description ?? object.summary ?? object.description ?? null;
  const state = object.state ?? object.status ?? revision.state ?? 'not stated';
  const revisionNumber = revision.revision ?? revision.revisionNumber ?? object.nodeRevision ?? object.revision ?? creation?.payload?.revision ?? null;
  const createdBy = revision.createdBy ?? object.createdBy ?? object.actorId ?? null;
  const createdAt = revision.createdAt ?? object.createdAt ?? payload?.createdAt ?? creation?.createdAt ?? null;
  /* Agents draft, a person signs: the creation Event names both. */
  const drafter = creation?.payload?.drafted_by_actor_id ?? creation?.payload?.producer_actor_id ?? createdBy;
  const publisher = creation?.payload?.publisher_actor_id ?? creation?.payload?.signer_actor_id ?? revision.publisherActorId ?? object.publisherActorId ?? payload?.publisherActorId ?? null;
  const signingKey = creation?.payload?.signing_key_id ?? null;
  const contentHash = creation?.payload?.canonical_content_hash ?? null;
  const signature = payload?.signature ?? revision.signature ?? object.signature ?? null;
  const provenance = revision.provenance ?? object.provenance ?? payload?.provenance ?? null;
  const projectId = object.projectId ?? revision.projectId ?? creation?.payload?.project_id ?? null;
  const resolvedRevision = Number.isInteger(Number(revisionNumber)) && Number(revisionNumber) > 0 ? Number(revisionNumber) : 1;
  const focusNode = {
    ref: { kind: type, id, revision: resolvedRevision },
    label: title,
    family: RESEARCH_NODE_DEFINITIONS[type]?.family ?? 'resource',
    state,
    canonicalHref: `/${collection}/${encodeURIComponent(id)}`,
    createdAt,
    createdBy,
    isCurrent: true,
  };
  const graphNodes = Array.isArray(graphPayload?.nodes) ? graphPayload.nodes : [];
  const hasFocus = graphNodes.some((node) => (node.ref?.id ?? node.nodeId ?? node.objectId ?? node.id) === id);
  const neighborhood = graphPayload
    ? (hasFocus ? graphPayload : { ...graphPayload, nodes: [focusNode, ...graphNodes] })
    : { complete: false, focusId: id, nodes: [focusNode], edges: [] };
  const rows = contentRows(type, revision, object);
  const refLabels = new Map(graphNodes
    .map((node) => [node.ref?.id ?? node.nodeId ?? node.objectId ?? node.id, node.label ?? node.title ?? node.statement ?? null])
    .filter(([key, label]) => key && label && key !== id));
  const project = projectId ? await readJson(`/projects/${encodeURIComponent(projectId)}`) : null;
  const projectName = project?.currentRevision?.name ?? project?.project?.name ?? null;
  const kindLabel = sentenceCase(type);

  const clauses = [
    { id: 'content', number: '1', label: 'Content' },
    { id: 'graph', number: '2', label: 'Graph' },
    { id: 'technical', number: '3', label: 'Record' },
  ];

  return (
    <div className="doc-page pb-20 pt-5 sm:pt-6">
      <Breadcrumb
        trail={[
          { label: 'Explore', href: '/explore' },
          ...(projectId ? [{ label: projectName ?? 'Project', href: `/projects/${encodeURIComponent(projectId)}` }] : []),
          { label: `${kindLabel} r${resolvedRevision}` },
        ]}
      />

      <TitleBlock
        cells={[
          { label: 'Revision', bare: true, value: <span className="tabular-nums">r{resolvedRevision}</span> },
          { label: 'Drafted by', value: drafter ? <ActorName actorId={drafter} /> : null },
          { label: 'Signed by', value: publisher ? <ActorName actorId={publisher} showOwner={false} /> : null },
          { label: 'Recorded', bare: true, value: isoDate(createdAt) ? <span className="tabular-nums text-muted-foreground">{isoDate(createdAt)}</span> : null },
          { label: 'Identifier', bare: true, value: <Identifier value={id} /> },
        ]}
        kind={kindLabel}
        notice={description ? <p className="max-w-[68ch] font-serif text-base leading-7 text-muted-foreground">{description}</p> : null}
        serif={SERIF_KINDS.has(type)}
        status={<StatusBadge state={String(state)} />}
        title={title}
      />

      <ClauseRail clauses={clauses} />

      <div className="doc-grid doc-grid--clauses mt-6">

        <article aria-label={`${kindLabel} content`} className="doc-main">
          <Clause id="content" number="1" title="Content">
            {rows.length > 0 ? (
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
                {rows.map(({ field, value }) => (
                  <div className="contents" key={field}>
                    <dt className="text-muted-foreground">{fieldLabel(field)}</dt>
                    <dd className="min-w-0 [overflow-wrap:anywhere]"><ContentValue field={field} labels={refLabels} value={value} /></dd>
                  </div>
                ))}
              </dl>
            ) : <p className="clause__none">None yet.</p>}
          </Clause>
        </article>

        <aside aria-label="Provenance" className="doc-margin">
          <MarginSection title="Provenance">
            <dl className="grid gap-2 text-[13px]">
              <div><dt className="text-xs text-muted-foreground">Drafted by</dt><dd className="mt-0.5"><ActorName actorId={drafter} /></dd></div>
              {publisher ? <div><dt className="text-xs text-muted-foreground">Signed by</dt><dd className="mt-0.5"><ActorName actorId={publisher} showOwner={false} /></dd></div> : null}
              {signingKey || researchValue(signature) ? <div><dt className="text-xs text-muted-foreground">Signature</dt><dd className="mt-0.5 truncate font-mono text-xs" title={String(signingKey ?? researchValue(signature))}>{shortId(String(signingKey ?? researchValue(signature)))}</dd></div> : null}
              {provenance ? <div><dt className="text-xs text-muted-foreground">Source lineage</dt><dd className="mt-0.5 break-all font-serif">{researchValue(provenance)}</dd></div> : null}
            </dl>
          </MarginSection>

          <MarginSection title="Revision">
            <p className="text-[13px] tabular-nums"><span className="font-mono">r{resolvedRevision}</span>{isoDate(createdAt) ? <span className="ml-2 text-muted-foreground">{isoDate(createdAt)}</span> : null}</p>
          </MarginSection>

          <MarginSection title="Continue">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <Link className="text-primary hover:underline" href={`/agent?object=${encodeURIComponent(id)}`}>Continue with an agent</Link>
              <Link className="text-primary hover:underline" href={`/events?objectType=${encodeURIComponent(type)}&objectId=${encodeURIComponent(id)}`}>Event audit</Link>
            </div>
          </MarginSection>
        </aside>

        <section aria-label={`${kindLabel} research neighborhood`} className="doc-span">
          <Clause id="graph" number="2" title="Research graph" wide>
            <ClaimDag direction="both" focusId={id} graph={neighborhood} />
          </Clause>
        </section>

        <div className="doc-after">
          <Clause id="technical" number="3" title="Record details">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
              <dt className="text-muted-foreground">Stable id</dt><dd className="break-all font-mono text-xs">{id}</dd>
              <dt className="text-muted-foreground">Rendered revision</dt><dd className="font-mono text-xs">{id}@r{resolvedRevision}</dd>
              <dt className="text-muted-foreground">Creation event</dt><dd className="break-all font-mono text-xs">{creation?.eventId ?? 'via event audit'}</dd>
              <dt className="text-muted-foreground">Event hash</dt><dd className="break-all font-mono text-xs">{creation?.hash ?? 'via event audit'}</dd>
              {contentHash ? <><dt className="text-muted-foreground">Content hash</dt><dd className="break-all font-mono text-xs">{contentHash}</dd></> : null}
              {signingKey ? <><dt className="text-muted-foreground">Signing key</dt><dd className="break-all font-mono text-xs">{signingKey}</dd></> : null}
            </dl>
            {payload ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground">Raw object data</summary>
                <pre className="mt-3 max-h-96 overflow-auto border border-border bg-muted p-3 font-mono text-xs leading-6">{JSON.stringify(payload, null, 2)}</pre>
              </details>
            ) : null}
          </Clause>
        </div>
      </div>
    </div>
  );
}
