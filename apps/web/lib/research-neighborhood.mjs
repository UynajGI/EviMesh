/**
 * Web compatibility boundary for the immutable research-neighborhood.v1 wire
 * contract and the legacy Claim graph payloads that predate it.
 *
 * `key` is the only graph identity. Stable object IDs are deliberately kept in
 * `id`; two revisions of the same object therefore remain distinct nodes.
 */

export const RESEARCH_NODE_DEFINITIONS = Object.freeze({
  project: Object.freeze({ family: 'structure', hrefPrefix: '/projects' }),
  research_contract: Object.freeze({ family: 'structure', hrefPrefix: '/contracts' }),
  question: Object.freeze({ family: 'structure', hrefPrefix: '/questions' }),
  answer: Object.freeze({ family: 'reasoning', hrefPrefix: '/answers' }),
  claim: Object.freeze({ family: 'reasoning', hrefPrefix: '/claims' }),
  rebuttal: Object.freeze({ family: 'reasoning', hrefPrefix: '/rebuttals' }),
  evaluation: Object.freeze({ family: 'reasoning', hrefPrefix: '/evaluations' }),
  dataset: Object.freeze({ family: 'resource', hrefPrefix: '/datasets' }),
  tool: Object.freeze({ family: 'resource', hrefPrefix: '/tools' }),
  artifact: Object.freeze({ family: 'resource', hrefPrefix: '/artifacts' }),
  evidence: Object.freeze({ family: 'resource', hrefPrefix: '/evidence' }),
  task: Object.freeze({ family: 'execution', hrefPrefix: '/tasks' }),
  attempt: Object.freeze({ family: 'execution', hrefPrefix: '/attempts' }),
  context_bundle: Object.freeze({ family: 'execution', hrefPrefix: '/context-bundles' }),
  run: Object.freeze({ family: 'execution', hrefPrefix: '/runs' }),
  verification_contract: Object.freeze({ family: 'verification', hrefPrefix: '/verification-contracts' }),
  verification_policy: Object.freeze({ family: 'verification', hrefPrefix: '/verification-policies' }),
  policy_evaluation: Object.freeze({ family: 'verification', hrefPrefix: '/policy-evaluations' }),
  verification_receipt: Object.freeze({ family: 'verification', hrefPrefix: '/verifications' }),
  verification_finding: Object.freeze({ family: 'verification', hrefPrefix: '/verification-findings' }),
  challenge: Object.freeze({ family: 'verification', hrefPrefix: '/challenges' }),
  merge_proposal: Object.freeze({ family: 'verification', hrefPrefix: '/merge-proposals' }),
  frontier_snapshot: Object.freeze({ family: 'verification', hrefPrefix: '/frontier-snapshots' }),
});

export const RESEARCH_NODE_KINDS = Object.freeze(Object.keys(RESEARCH_NODE_DEFINITIONS));

const TYPE_PREFIXES = Object.freeze({
  ans: 'answer', art: 'artifact', atm: 'attempt', cha: 'challenge', clm: 'claim',
  ctx: 'context_bundle', dat: 'dataset', eva: 'evaluation', evd: 'evidence',
  fnt: 'frontier_snapshot', mrg: 'merge_proposal', pev: 'policy_evaluation',
  prj: 'project', qst: 'question', rct: 'research_contract', reb: 'rebuttal',
  run: 'run', tsk: 'task', tol: 'tool', vct: 'verification_contract',
  vfd: 'verification_finding', vpc: 'verification_policy', ver: 'verification_receipt',
});

const LEGACY_KIND_ALIASES = Object.freeze({ verification: 'verification_receipt' });

function stringValue(...values) {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return value?.trim() ?? null;
}

function positiveRevision(value, fallback = null) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : fallback;
}

function inferType(id) {
  const prefix = String(id ?? '').split(/[_:-]/, 1)[0].toLowerCase();
  return TYPE_PREFIXES[prefix] ?? 'claim';
}

function normalizeType(value, id) {
  const candidate = String(value ?? inferType(id)).toLowerCase().replaceAll('-', '_');
  const type = LEGACY_KIND_ALIASES[candidate] ?? candidate;
  return RESEARCH_NODE_DEFINITIONS[type] ? type : 'artifact';
}

function normalizeRef(value, fallback = {}) {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const id = stringValue(candidate.id, fallback.id);
  if (!id) return null;
  const kind = normalizeType(candidate.kind ?? fallback.kind, id);
  const revision = positiveRevision(candidate.revision ?? fallback.revision, 1);
  return Object.freeze({ kind, id, revision });
}

export function nodeRevisionKey(ref) {
  const normalized = normalizeRef(ref);
  return normalized ? `${normalized.kind}:${normalized.id}@${normalized.revision}` : null;
}

export function normalizeResearchNode(input = {}) {
  const row = input?.data ?? input;
  const legacyId = stringValue(row.nodeId, row.objectId, row.claimId, row.questionId, row.id);
  const legacyKind = row.nodeType ?? row.objectType ?? row.kind ?? row.type;
  const legacyRevision = row.nodeRevision ?? row.revision ?? row.revisionNumber ?? row.currentRevision?.revision;
  const ref = normalizeRef(row.ref, { id: legacyId, kind: legacyKind, revision: legacyRevision });

  if (!ref) return null;
  const definition = RESEARCH_NODE_DEFINITIONS[ref.kind];
  const canonicalHref = stringValue(row.canonicalHref, row.href, row.permalink)
    ?? `${definition.hrefPrefix}/${encodeURIComponent(ref.id)}`;
  const suppliedDepth = Number(row.distance ?? row.depth);
  return {
    key: nodeRevisionKey(ref),
    id: ref.id,
    ref,
    type: ref.kind,
    family: stringValue(row.family) ?? definition.family,
    label: stringValue(row.label, row.title, row.statement, row.name, ref.id),
    revision: ref.revision,
    state: stringValue(row.state, row.status, 'unknown'),
    depth: Number.isFinite(suppliedDepth) ? Math.abs(suppliedDepth) : null,
    distance: Number.isFinite(suppliedDepth) ? Math.abs(suppliedDepth) : null,
    direction: stringValue(row.direction, row.side),
    canonicalHref,
    href: canonicalHref,
    createdAt: stringValue(row.createdAt),
    createdBy: stringValue(row.createdBy),
    isCurrent: row.isCurrent !== false,
    raw: row,
  };
}

function edgeEndpoint(row, side) {
  const direct = row[side];
  const reference = normalizeRef(
    direct && typeof direct === 'object' ? direct : row[`${side}Ref`],
  );
  const legacy = stringValue(
    row[`${side}NodeId`],
    row[`${side}ObjectId`],
    row[`${side}ClaimId`],
    row[`${side}Id`],
    typeof direct === 'string' ? direct : null,
  );
  return { key: reference ? nodeRevisionKey(reference) : legacy, ref: reference };
}

export function normalizeResearchEdge(input = {}, index = 0) {
  const row = input?.data ?? input;
  const source = edgeEndpoint(row, 'source');
  const target = edgeEndpoint(row, 'target');
  if (!source.key || !target.key) return null;
  const type = stringValue(row.type, row.relationType, row.edgeType, row.relation, 'depends_on');
  return {
    id: stringValue(row.id, row.edgeId, row.relationId, `${source.key}:${type}:${target.key}:${index}`),
    type,
    relation: type,
    family: stringValue(row.family, 'dependency'),
    forwardLabel: stringValue(row.forwardLabel, type),
    reverseLabel: stringValue(row.reverseLabel, type),
    source: source.key,
    target: target.key,
    sourceRef: source.ref,
    targetRef: target.ref,
    provenanceEventId: stringValue(row.provenanceEventId),
    raw: row,
  };
}

function resolveStableNodeKey(value, nodeMap, stableKeys) {
  if (nodeMap.has(value)) return value;
  const candidates = stableKeys.get(value) ?? [];
  if (candidates.length === 0) return null;
  const current = candidates.find((key) => nodeMap.get(key)?.isCurrent);
  return current ?? candidates.at(-1);
}

function resolveRootKey(container, nodeMap, stableKeys) {
  const candidates = [container.resolvedRoot, container.requestedRoot, container.root]
    .map((candidate) => normalizeRef(candidate))
    .filter(Boolean);
  for (const ref of candidates) {
    const exact = nodeRevisionKey(ref);
    if (nodeMap.has(exact)) return exact;
    const stable = resolveStableNodeKey(ref.id, nodeMap, stableKeys);
    if (stable) return stable;
  }
  const focus = stringValue(container.focusKey, container.focusId);
  return focus ? resolveStableNodeKey(focus, nodeMap, stableKeys) : nodeMap.keys().next().value ?? null;
}

function distancesFrom(rootKey, edges) {
  const incoming = new Map();
  const outgoing = new Map();
  for (const edge of edges) {
    const sources = incoming.get(edge.target) ?? [];
    sources.push(edge.source);
    incoming.set(edge.target, sources);
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }
  const walk = (adjacency) => {
    const distances = new Map(rootKey ? [[rootKey, 0]] : []);
    const queue = rootKey ? [rootKey] : [];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const key = queue[cursor];
      const nextDistance = distances.get(key) + 1;
      for (const next of adjacency.get(key) ?? []) {
        if (distances.has(next)) continue;
        distances.set(next, nextDistance);
        queue.push(next);
      }
    }
    return distances;
  };
  return { downstream: walk(outgoing), upstream: walk(incoming) };
}

/**
 * Normalize a bounded neighborhood without reversing or inventing protocol
 * edges. Legacy string endpoints are resolved only to a visible node revision.
 */
export function normalizeResearchNeighborhood(input) {
  const container = Array.isArray(input) ? { elements: input } : (input ?? {});
  const elements = Array.isArray(container.elements) ? container.elements : [];
  const nodeInputs = Array.isArray(container.nodes)
    ? container.nodes
    : elements.filter((element) => !edgeEndpoint(element?.data ?? element ?? {}, 'source').key);
  const edgeInputs = Array.isArray(container.edges)
    ? container.edges
    : elements.filter((element) => edgeEndpoint(element?.data ?? element ?? {}, 'source').key);

  const nodeMap = new Map();
  const stableKeys = new Map();
  for (const inputNode of nodeInputs) {
    const node = normalizeResearchNode(inputNode);
    if (!node || nodeMap.has(node.key)) continue;
    nodeMap.set(node.key, node);
    const keys = stableKeys.get(node.id) ?? [];
    keys.push(node.key);
    keys.sort((left, right) => nodeMap.get(left).revision - nodeMap.get(right).revision);
    stableKeys.set(node.id, keys);
  }

  const edgeMap = new Map();
  edgeInputs.forEach((inputEdge, index) => {
    const edge = normalizeResearchEdge(inputEdge, index);
    if (!edge) return;
    const source = resolveStableNodeKey(edge.source, nodeMap, stableKeys);
    const target = resolveStableNodeKey(edge.target, nodeMap, stableKeys);
    if (!source || !target) return;
    const normalized = { ...edge, source, target, layoutSource: source, layoutTarget: target };
    if (!edgeMap.has(normalized.id)) edgeMap.set(normalized.id, normalized);
  });

  const edges = [...edgeMap.values()];
  const rootKey = resolveRootKey(container, nodeMap, stableKeys);
  const distances = distancesFrom(rootKey, edges);
  const nodes = [...nodeMap.values()].map((node) => {
    if (node.key === rootKey) return { ...node, depth: 0, distance: 0, direction: 'focus' };
    const upstream = distances.upstream.get(node.key);
    const downstream = distances.downstream.get(node.key);
    if (upstream !== undefined && (downstream === undefined || upstream <= downstream)) {
      return { ...node, depth: upstream, distance: upstream, direction: 'upstream' };
    }
    if (downstream !== undefined) return { ...node, depth: downstream, distance: downstream, direction: 'downstream' };
    return node;
  });
  const isWireContract = container.schemaVersion === 'research-neighborhood.v1';
  return {
    schemaVersion: container.schemaVersion ?? null,
    requestedRoot: normalizeRef(container.requestedRoot),
    resolvedRoot: normalizeRef(container.resolvedRoot),
    rootKey,
    nodes,
    edges,
    truncated: Boolean(container.truncated),
    permissionPartial: Boolean(container.permissionPartial),
    nextCursor: stringValue(container.nextCursor),
    graphWatermark: stringValue(container.graphWatermark),
    complete: isWireContract
      ? !Boolean(container.truncated) && !Boolean(container.permissionPartial)
      : container.complete === true || container.topologyComplete === true,
  };
}

export function resolveResearchNodeKey(nodes, value) {
  if (!value) return null;
  if (typeof value === 'object') {
    const key = nodeRevisionKey(value.ref ?? value);
    if (key && nodes.some((node) => node.key === key)) return key;
    value = value.id;
  }
  const exact = nodes.find((node) => node.key === value);
  if (exact) return exact.key;
  const stable = nodes.filter((node) => node.id === value);
  return stable.find((node) => node.isCurrent)?.key ?? stable.at(-1)?.key ?? null;
}

export function relationshipsForSelection(nodes, edges, selection) {
  const selectedKey = resolveResearchNodeKey(nodes, selection);
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
  const upstream = [];
  const downstream = [];
  for (const edge of edges) {
    if (edge.target === selectedKey && nodeByKey.has(edge.source)) {
      upstream.push({ ...edge, node: nodeByKey.get(edge.source), direction: 'upstream', relationLabel: edge.reverseLabel });
    }
    if (edge.source === selectedKey && nodeByKey.has(edge.target)) {
      downstream.push({ ...edge, node: nodeByKey.get(edge.target), direction: 'downstream', relationLabel: edge.forwardLabel });
    }
  }
  return { upstream, downstream };
}

export function filterResearchNeighborhood(graph, options = {}) {
  const types = new Set((options.types ?? []).filter(Boolean));
  const states = new Set((options.states ?? []).filter(Boolean));
  const maxDepth = Number.isFinite(Number(options.maxDepth)) ? Number(options.maxDepth) : Infinity;
  const direction = options.direction ?? 'both';
  const focusKey = resolveResearchNodeKey(graph.nodes, options.focusKey ?? options.focusId ?? graph.rootKey);
  const keepKeys = new Set(graph.nodes.filter((node) => {
    if (node.key === focusKey) return true;
    if (types.size > 0 && !types.has(node.type)) return false;
    if (states.size > 0 && !states.has(node.state)) return false;
    if ((node.distance ?? node.depth ?? 0) > maxDepth) return false;
    if (direction !== 'both' && node.direction && node.direction !== direction) return false;
    return true;
  }).map((node) => node.key));
  const nodes = graph.nodes.filter((node) => keepKeys.has(node.key));
  const edges = graph.edges.filter((edge) => keepKeys.has(edge.source) && keepKeys.has(edge.target));
  const filtered = nodes.length !== graph.nodes.length || edges.length !== graph.edges.length;
  return {
    ...graph,
    rootKey: focusKey ?? graph.rootKey,
    nodes,
    edges,
    complete: graph.complete === true && !filtered,
  };
}
