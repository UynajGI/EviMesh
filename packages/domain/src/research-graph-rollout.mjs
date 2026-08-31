import {
  assertResearchGraphReadMode,
  assertResearchGraphWriteMode,
} from '../../protocol/src/research-graph-rollout.mjs';

export class ResearchGraphRolloutError extends Error {
  constructor(message, code = 'RESEARCH_GRAPH_ROLLOUT_INVALID', status = 400) {
    super(message);
    this.name = 'ResearchGraphRolloutError';
    this.code = code;
    this.status = status;
  }
}

function refKey(ref) {
  return `${ref.kind}:${ref.id}@${ref.revision}`;
}

function nodeKeys(neighborhood) {
  if (!Array.isArray(neighborhood?.nodes)) throw new ResearchGraphRolloutError('neighborhood nodes must be an array');
  return [...new Set(neighborhood.nodes.map((node) => refKey(node.ref)))].sort();
}

function edgeKeys(neighborhood) {
  if (!Array.isArray(neighborhood?.edges)) throw new ResearchGraphRolloutError('neighborhood edges must be an array');
  return [...new Set(neighborhood.edges.map((edge) => `${edge.type}:${refKey(edge.source)}>${refKey(edge.target)}`))].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

async function emitParitySafely(observer, report) {
  if (!observer) return;
  try {
    await observer(report);
  } catch {
    // Shadow telemetry is deliberately best-effort and must never change the
    // authoritative legacy response or its availability semantics.
  }
}

/** Compare only stable semantic identity; cursors, watermarks, and presentation text are not parity signals. */
export function compareResearchGraphParity({ legacy, kernel } = {}) {
  const legacyNodes = nodeKeys(legacy);
  const kernelNodes = nodeKeys(kernel);
  const legacyEdges = edgeKeys(legacy);
  const kernelEdges = edgeKeys(kernel);
  const report = {
    matches: false,
    missingKernelNodes: difference(legacyNodes, kernelNodes),
    unexpectedKernelNodes: difference(kernelNodes, legacyNodes),
    missingKernelEdges: difference(legacyEdges, kernelEdges),
    unexpectedKernelEdges: difference(kernelEdges, legacyEdges),
    visibilityComparable: Boolean(legacy?.permissionPartial) === Boolean(kernel?.permissionPartial),
    truncationComparable: Boolean(legacy?.truncated) === Boolean(kernel?.truncated),
  };
  report.matches = report.missingKernelNodes.length === 0
    && report.unexpectedKernelNodes.length === 0
    && report.missingKernelEdges.length === 0
    && report.unexpectedKernelEdges.length === 0
    && report.visibilityComparable
    && report.truncationComparable;
  return Object.freeze(Object.fromEntries(Object.entries(report).map(([key, value]) => [key, Array.isArray(value) ? Object.freeze(value) : value])));
}

/**
 * In shadow mode both readers receive the same authorization scope. The
 * legacy result remains authoritative; parity is emitted only to the supplied
 * internal observer and never added to the public wire payload.
 */
export async function readResearchGraphWithShadow({
  mode = 'legacy',
  readLegacy,
  readKernel,
  cutoverReady = false,
  onParity = null,
} = {}) {
  try {
    mode = assertResearchGraphReadMode(mode);
  } catch (error) {
    throw new ResearchGraphRolloutError(error.message);
  }
  if (mode !== 'kernel' && typeof readLegacy !== 'function') throw new ResearchGraphRolloutError('legacy graph reader is required');
  if (mode !== 'legacy' && typeof readKernel !== 'function') throw new ResearchGraphRolloutError('kernel graph reader is required');
  if (onParity !== null && typeof onParity !== 'function') throw new ResearchGraphRolloutError('parity observer must be a function or null');
  if (mode === 'legacy') return readLegacy();
  if (mode === 'kernel') {
    if (cutoverReady !== true) throw new ResearchGraphRolloutError('kernel read is blocked until the project cutover gate passes', 'RESEARCH_GRAPH_CUTOVER_BLOCKED', 409);
    return readKernel();
  }

  const legacy = await readLegacy();
  try {
    const kernel = await readKernel();
    await emitParitySafely(onParity, compareResearchGraphParity({ legacy, kernel }));
  } catch (error) {
    await emitParitySafely(onParity, Object.freeze({ matches: false, shadowError: error instanceof Error ? error.message : String(error) }));
  }
  return legacy;
}

/**
 * Dual writes share one repository transaction. A parity assertion is
 * mandatory so a mismatch rolls back both projections instead of drifting.
 */
export async function executeResearchGraphWrite({
  repository,
  mode = 'legacy',
  writeLegacy,
  writeKernel,
  assertParity = null,
  cutoverReady = false,
} = {}) {
  if (!repository || typeof repository.withTransaction !== 'function') throw new ResearchGraphRolloutError('repository withTransaction is required');
  try {
    mode = assertResearchGraphWriteMode(mode);
  } catch (error) {
    throw new ResearchGraphRolloutError(error.message);
  }
  if (mode !== 'kernel' && typeof writeLegacy !== 'function') throw new ResearchGraphRolloutError('legacy graph writer is required');
  if (mode !== 'legacy' && typeof writeKernel !== 'function') throw new ResearchGraphRolloutError('kernel graph writer is required');
  if (mode === 'dual_write' && typeof assertParity !== 'function') throw new ResearchGraphRolloutError('dual-write parity assertion is required');
  if (mode === 'kernel' && cutoverReady !== true) throw new ResearchGraphRolloutError('kernel write is blocked until the project cutover gate passes', 'RESEARCH_GRAPH_CUTOVER_BLOCKED', 409);

  return repository.withTransaction(async (transaction) => {
    if (mode === 'legacy') return Object.freeze({ legacy: await writeLegacy(transaction), kernel: null });
    if (mode === 'kernel') return Object.freeze({ legacy: null, kernel: await writeKernel(transaction) });
    const legacy = await writeLegacy(transaction);
    const kernel = await writeKernel(transaction);
    const parity = await assertParity({ legacy, kernel });
    if (parity !== true) throw new ResearchGraphRolloutError('dual-write projections are not equivalent', 'RESEARCH_GRAPH_DUAL_WRITE_MISMATCH', 409);
    return Object.freeze({ legacy, kernel });
  });
}
