import Link from 'next/link';
import { ClaimDag } from '@/components/claim-dag';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { readResearchNeighborhood } from '@/lib/research-object-data.mjs';
import { RESEARCH_NODE_DEFINITIONS } from '@/lib/research-neighborhood.mjs';

function readable(value, fallback = 'not stated') {
  return String(value ?? fallback).replaceAll('_', ' ');
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

const TYPE_CONTENT_FIELDS = Object.freeze({
  answer: ['synthesis', 'limitations', 'questionRef', 'additionalInputs'],
  rebuttal: ['argument', 'scope', 'targetRef', 'basisRefs'],
  evaluation: ['stance', 'rationale', 'method', 'subjectRef', 'basisRefs'],
  dataset: ['description', 'version', 'license', 'schemaUri', 'provenance', 'artifactRef'],
  tool: ['description', 'toolKind', 'version', 'runtime', 'inputSchemaUri', 'outputSchemaUri', 'license', 'provenance', 'artifactRef'],
});

function researchValue(value) {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) return value.map(researchValue).filter(Boolean).join(' / ');
  if (typeof value === 'object') {
    if (value.kind && value.id) return `${value.kind}:${value.id}${value.revision ? `@r${value.revision}` : ''}`;
    return JSON.stringify(value);
  }
  return String(value);
}

function contentRows(type, revision, object) {
  const preferred = TYPE_CONTENT_FIELDS[type] ?? ['statement', 'summary', 'description', 'method', 'outcome'];
  return preferred
    .map((field) => ({ field, value: researchValue(revision[field] ?? object[field]) }))
    .filter(({ value }) => value);
}

export async function ResearchObjectDetail({ collection, id, type }) {
  const [payload, graphPayload] = await Promise.all([
    readJson(`/${collection}/${encodeURIComponent(id)}`),
    readNeighborhood(id, type),
  ]);
  const object = objectFromPayload(payload, type);
  const revision = revisionFromPayload(payload, object);
  const title = revision.title ?? revision.statement ?? revision.name ?? revision.label ?? object.title ?? object.statement ?? object.name ?? object.label ?? `${readable(type)} ${id}`;
  const description = revision.summary ?? revision.description ?? object.summary ?? object.description ?? 'This object is available by stable ID. Descriptive fields are not exposed by the current API deployment.';
  const state = object.state ?? object.status ?? revision.state ?? 'not stated';
  const revisionNumber = revision.revision ?? revision.revisionNumber ?? object.nodeRevision ?? object.revision ?? null;
  const createdBy = revision.createdBy ?? object.createdBy ?? object.actorId ?? null;
  const createdAt = revision.createdAt ?? object.createdAt ?? payload?.createdAt ?? null;
  const publisher = revision.publisherActorId ?? object.publisherActorId ?? payload?.publisherActorId ?? null;
  const signature = payload?.signature ?? revision.signature ?? object.signature ?? null;
  const provenance = revision.provenance ?? object.provenance ?? payload?.provenance ?? null;
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

  return (
    <PageContainer wide>
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground"><Link className="hover:text-primary" href="/explore">Explore</Link><span aria-hidden="true">/</span><span>{readable(type)}</span><span aria-hidden="true">/</span><code>{id}</code></nav>
      <PageHeader description={description} eyebrow={readable(type)} title={title} />
      <dl className="grid min-w-0 grid-cols-12 border-b border-foreground py-5 font-mono text-[10px]">
        <div className="col-span-6 min-w-0 border-r border-border pr-3 sm:col-span-3"><dt className="text-muted-foreground">STATE</dt><dd className="mt-2 uppercase text-primary">{readable(state)}</dd></div>
        <div className="col-span-6 min-w-0 pl-3 sm:col-span-3 sm:border-r sm:border-border"><dt className="text-muted-foreground">NODE REVISION</dt><dd className="mt-2">{revisionNumber != null ? `r${revisionNumber}` : 'not stated'}</dd></div>
        <div className="col-span-12 mt-4 min-w-0 border-t border-border pt-4 sm:col-span-3 sm:mt-0 sm:border-t-0 sm:border-r sm:pl-3 sm:pt-0"><dt className="text-muted-foreground">ATTRIBUTION</dt><dd className="mt-2 [overflow-wrap:anywhere]">{createdBy ?? 'not stated'}</dd></div>
        <div className="col-span-12 mt-4 min-w-0 border-t border-border pt-4 sm:col-span-3 sm:mt-0 sm:border-t-0 sm:pl-3 sm:pt-0"><dt className="text-muted-foreground">STABLE ID</dt><dd className="mt-2 [overflow-wrap:anywhere]">{id}</dd></div>
      </dl>
      <section className="grid min-w-0 grid-cols-12 gap-y-8 border-b border-foreground py-10 lg:gap-x-8" aria-label={`${readable(type)} content and provenance`}>
        <article className="col-span-12 min-w-0 lg:col-span-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-primary">TYPE CONTENT</p>
          <h2 className="mt-4 max-w-[24ch] font-serif text-[clamp(2rem,5vw,4.75rem)] font-medium leading-[0.96] tracking-[-0.045em] [overflow-wrap:anywhere]">{title}</h2>
          <p className="mt-6 max-w-[68ch] font-serif text-lg leading-8 text-muted-foreground">{description}</p>
          {rows.length > 0 ? <dl className="mt-8 border-t border-border">{rows.map(({ field, value }) => <div className="grid min-w-0 grid-cols-12 gap-3 border-b border-border py-4" key={field}><dt className="col-span-4 font-mono text-[10px] font-bold uppercase text-primary sm:col-span-3">{readable(field)}</dt><dd className="col-span-8 min-w-0 font-serif text-sm leading-6 [overflow-wrap:anywhere] sm:col-span-9">{value}</dd></div>)}</dl> : <p className="mt-8 border-t border-border py-4 text-sm text-muted-foreground">Typed content is not exposed by this API deployment.</p>}
        </article>
        <aside className="col-span-12 min-w-0 border-t border-foreground pt-5 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-label="Provenance marginalia">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-primary">PROVENANCE MARGINALIA</p>
          <dl className="mt-5 divide-y divide-border border-y border-border font-mono text-[10px]">
            <div className="py-4"><dt className="text-muted-foreground">NODE REVISION</dt><dd className="mt-1 [overflow-wrap:anywhere]">{id}@r{resolvedRevision}</dd></div>
            <div className="py-4"><dt className="text-muted-foreground">STATE</dt><dd className="mt-1 uppercase">{readable(state)}</dd></div>
            <div className="py-4"><dt className="text-muted-foreground">DRAFTED / CREATED BY</dt><dd className="mt-1 [overflow-wrap:anywhere]">{createdBy ?? 'not stated'}</dd></div>
            <div className="py-4"><dt className="text-muted-foreground">PUBLISHER</dt><dd className="mt-1 [overflow-wrap:anywhere]">{publisher ?? 'not included in detail response'}</dd></div>
            <div className="py-4"><dt className="text-muted-foreground">CREATED</dt><dd className="mt-1 [overflow-wrap:anywhere]">{createdAt ?? 'not stated'}</dd></div>
            <div className="py-4"><dt className="text-muted-foreground">SIGNATURE</dt><dd className="mt-1 [overflow-wrap:anywhere]">{researchValue(signature) ?? 'Inspect the signed Event record'}</dd></div>
            <div className="py-4"><dt className="text-muted-foreground">PROVENANCE</dt><dd className="mt-1 [overflow-wrap:anywhere]">{researchValue(provenance) ?? 'Inspect revision lineage and Event proof'}</dd></div>
          </dl>
        </aside>
      </section>
      <section className="mt-10 min-w-0" aria-label={`${readable(type)} research neighborhood`}><ClaimDag direction="both" focusId={id} graph={neighborhood} /></section>
      <section className="mt-10 grid min-w-0 grid-cols-12 gap-5 border-t border-foreground py-8"><p className="col-span-12 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-primary sm:col-span-2">READ-ONLY WEB</p><div className="col-span-12 min-w-0 sm:col-span-7"><h2 className="font-serif text-3xl font-medium tracking-[-0.03em]">Continue through your Agent.</h2><p className="mt-3 max-w-[50ch] text-sm leading-6 text-muted-foreground">Drafting, evaluation, verification and transitions happen through CLI or MCP. Human-controlled local signing remains outside the public reading surface.</p></div><div className="col-span-12 sm:col-span-3"><Link className="inline-flex min-h-11 w-full items-center justify-between border border-foreground px-4 font-mono text-[10px] font-bold uppercase text-primary hover:bg-foreground hover:text-background" href={`/agent?object=${encodeURIComponent(id)}`}>Open Agent connection <span>→</span></Link></div></section>
      {payload ? <details className="border-t border-border py-5"><summary className="cursor-pointer font-mono text-[10px] font-bold uppercase text-muted-foreground">Technical object data</summary><pre className="mt-4 max-h-96 overflow-auto border border-border bg-muted p-4 text-xs leading-6">{JSON.stringify(payload, null, 2)}</pre></details> : null}
      <footer className="grid min-w-0 grid-cols-12 gap-3 border-y border-foreground py-5 font-mono text-[10px] uppercase" aria-label="Revision signature and provenance summary"><p className="col-span-12 min-w-0 sm:col-span-4"><span className="text-primary">REVISION</span><br />{id}@r{resolvedRevision}</p><p className="col-span-12 min-w-0 [overflow-wrap:anywhere] sm:col-span-4"><span className="text-primary">SIGNATURE</span><br />{researchValue(signature) ?? 'Signed Event record'}</p><p className="col-span-12 min-w-0 [overflow-wrap:anywhere] sm:col-span-4"><span className="text-primary">PROVENANCE</span><br />{researchValue(provenance) ?? createdBy ?? 'Revision lineage and Event proof'}</p></footer>
    </PageContainer>
  );
}
