export const RESEARCH_GRAPH_READ_MODES = Object.freeze(['legacy', 'shadow', 'kernel']);
export const RESEARCH_GRAPH_WRITE_MODES = Object.freeze(['legacy', 'dual_write', 'kernel']);
export const RESEARCH_GRAPH_LEGACY_DUAL_WRITE_RPC = 'execute_research_graph_legacy_dual_write';
export const RESEARCH_GRAPH_LEGACY_MUTATION_KINDS = Object.freeze([
  'claim.create', 'claim.revise', 'claim.transition',
  'evidence.create', 'evidence.link',
  'verification_receipt.submit',
  'challenge.create', 'challenge.transition',
]);
export const RESEARCH_GRAPH_LEGACY_DUAL_WRITE_PARAMS = Object.freeze([
  'p_mutation_kind', 'p_command', 'p_verified_events', 'p_expected_legacy',
]);

const READ_MODE_SET = new Set(RESEARCH_GRAPH_READ_MODES);
const WRITE_MODE_SET = new Set(RESEARCH_GRAPH_WRITE_MODES);
const LEGACY_MUTATION_KIND_SET = new Set(RESEARCH_GRAPH_LEGACY_MUTATION_KINDS);

export function assertResearchGraphReadMode(value) {
  if (typeof value !== 'string' || !READ_MODE_SET.has(value)) throw new TypeError(`unsupported research graph read mode: ${String(value)}`);
  return value;
}

export function assertResearchGraphWriteMode(value) {
  if (typeof value !== 'string' || !WRITE_MODE_SET.has(value)) throw new TypeError(`unsupported research graph write mode: ${String(value)}`);
  return value;
}

export function assertResearchGraphLegacyMutationKind(value) {
  if (typeof value !== 'string' || !LEGACY_MUTATION_KIND_SET.has(value)) {
    throw new TypeError(`unsupported legacy research graph mutation kind: ${String(value)}`);
  }
  return value;
}

/** Defaults are deliberately legacy-only until a project passes its cutover gate. */
export function resolveResearchGraphRollout({ readMode = 'legacy', writeMode = 'legacy' } = {}) {
  readMode = assertResearchGraphReadMode(readMode);
  writeMode = assertResearchGraphWriteMode(writeMode);
  if (readMode === 'kernel' && writeMode === 'legacy') throw new RangeError('kernel reads cannot run with legacy-only writes');
  return Object.freeze({ readMode, writeMode });
}
