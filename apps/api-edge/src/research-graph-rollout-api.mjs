import { readResearchGraphWithShadow, executeResearchGraphWrite, ResearchGraphRolloutError } from '../../../packages/domain/src/research-graph-rollout.mjs';
import { resolveResearchGraphRollout } from '../../../packages/protocol/src/research-graph-rollout.mjs';

const LEGACY_MUTATION_KINDS = new Set([
  'claim.create', 'claim.revise', 'claim.transition',
  'evidence.create', 'evidence.link',
  'verification_receipt.submit',
  'challenge.create', 'challenge.transition',
]);

const CAPTURED_MUTATION_METHODS = new Set([
  'insertClaim', 'insertClaimRevision', 'updateClaim',
  'insertContributionStatement', 'insertContributionEdge',
  'insertEvidence', 'insertEvidenceClaimLink',
  'insertVerificationReceipt', 'insertVerificationFinding',
  'insertChallenge', 'insertChallengeRevision',
  'appendResearchEvent',
]);

export class ApiResearchGraphRolloutError extends Error {
  constructor(message, code = 'RESEARCH_GRAPH_ROLLOUT_INVALID', status = 400) {
    super(message);
    this.name = 'ApiResearchGraphRolloutError';
    this.code = code;
    this.status = status;
  }
}

function asBoolean(value, field) {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false' || value === undefined || value === null || value === '') return false;
  throw new ApiResearchGraphRolloutError(`${field} must be true or false`);
}

function ref(kind, id, revision = 1) {
  return { kind, id: String(id), revision: Number.isInteger(Number(revision)) && Number(revision) > 0 ? Number(revision) : 1 };
}

function edge(type, source, target) {
  return { type: String(type), source, target };
}

function claimGraphEnvelope(value) {
  const root = ref('claim', value?.rootClaimId ?? 'missing');
  const nodes = [root, ...(value?.nodes ?? []).map((node) => ref('claim', node.claimId))];
  const edges = (value?.edges ?? []).map((item) => edge(
    item.relationType ?? 'unknown',
    ref('claim', item.sourceClaimId, item.sourceRevision),
    ref('claim', item.targetClaimId, item.targetRevision),
  ));
  return { nodes: nodes.map((node) => ({ ref: node })), edges, truncated: Boolean(value?.truncated), permissionPartial: Boolean(value?.permissionPartial) };
}

function evidenceEnvelope(value) {
  const evidenceId = value?.evidence?.evidenceId ?? 'missing';
  const root = ref('evidence', evidenceId);
  const claimRefs = (value?.claimLinks ?? []).map((link) => ref('claim', link.claimId, link.claimRevision));
  return {
    nodes: [root, ...claimRefs].map((node) => ({ ref: node })),
    edges: (value?.claimLinks ?? []).map((link) => edge(link.relationType ?? 'unknown', root, ref('claim', link.claimId, link.claimRevision))),
    truncated: false,
    permissionPartial: Boolean(value?.permissionPartial),
  };
}

function challengeEnvelope(value) {
  const challengeId = value?.challenge?.challengeId ?? value?.currentRevision?.challengeId ?? 'missing';
  const challengeRef = ref('challenge', challengeId, value?.currentRevision?.revision);
  const targetRef = value?.currentRevision?.targetClaimId
    ? ref('claim', value.currentRevision.targetClaimId, value.currentRevision.targetClaimRevision)
    : null;
  const impactRefs = (value?.impacts ?? []).map((impact) => ref('claim', impact.claimId, impact.claimRevision));
  const evidenceRefs = (value?.linkedEvidence ?? []).map((item) => ref('evidence', item.evidenceId));
  return {
    nodes: [challengeRef, ...(targetRef ? [targetRef] : []), ...impactRefs, ...evidenceRefs].map((node) => ({ ref: node })),
    edges: [
      ...(targetRef ? [edge('challenge_target', targetRef, challengeRef)] : []),
      ...impactRefs.map((source) => edge('challenge_impact', source, challengeRef)),
      ...evidenceRefs.map((source) => edge('challenge_evidence', source, challengeRef)),
    ],
    truncated: false,
    permissionPartial: Boolean(value?.permissionPartial),
  };
}

function receiptEnvelope(value) {
  const receipt = value?.receipt ?? {};
  const receiptRef = ref('verification_receipt', receipt.receiptId ?? 'missing');
  const findingRefs = (value?.findings ?? []).map((finding) => ref('verification_finding', finding.findingId));
  const subject = receipt.claimId ? ref('claim', receipt.claimId, receipt.claimRevision) : null;
  return {
    nodes: [receiptRef, ...(subject ? [subject] : []), ...findingRefs].map((node) => ({ ref: node })),
    edges: [
      ...(subject ? [edge('verification_subject', subject, receiptRef)] : []),
      ...findingRefs.map((target) => edge('verification_finding', receiptRef, target)),
    ],
    truncated: false,
    permissionPartial: Boolean(value?.permissionPartial),
  };
}

function receiptListEnvelope(value) {
  const items = Array.isArray(value) ? value : value?.items ?? [];
  const nodes = [];
  const edges = [];
  for (const receipt of items) {
    const receiptRef = ref('verification_receipt', receipt.receiptId ?? 'missing');
    nodes.push({ ref: receiptRef });
    if (receipt.claimId) {
      const subject = ref('claim', receipt.claimId, receipt.claimRevision);
      nodes.push({ ref: subject });
      edges.push(edge('verification_subject', subject, receiptRef));
    }
  }
  return { nodes, edges, truncated: false, permissionPartial: Boolean(value?.permissionPartial) };
}

function parityEnvelope(surface, value) {
  switch (surface) {
    case 'claim_graph': return claimGraphEnvelope(value);
    case 'evidence_detail': return evidenceEnvelope(value);
    case 'challenge_detail': return challengeEnvelope(value);
    case 'verification_receipt_detail': return receiptEnvelope(value);
    case 'verification_receipt_list': return receiptListEnvelope(value);
    default: throw new ApiResearchGraphRolloutError(`unsupported compatibility surface: ${surface}`);
  }
}

function transactionFacade(transaction) {
  if (!transaction || typeof transaction !== 'object') return transaction;
  if (typeof transaction.withTransaction === 'function') return transaction;
  const facade = Object.create(transaction);
  Object.defineProperty(facade, 'withTransaction', { enumerable: true, value: async (callback) => callback(transaction) });
  return Object.freeze(facade);
}

function jsonValue(value, field) {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('value is undefined');
    return JSON.parse(encoded);
  } catch (error) {
    throw new ApiResearchGraphRolloutError(`${field} is not JSON-compatible: ${error.message}`, 'RESEARCH_GRAPH_DUAL_WRITE_INVALID');
  }
}

function capturedReturn(method, args) {
  if (method === 'updateClaim') return { claimId: args[0], ...(args[1] ?? {}) };
  if (method === 'appendResearchEvent') {
    const event = args[0] ?? {};
    return {
      eventId: event.eventId ?? event.event_id,
      eventType: event.eventType ?? event.event_type,
      payload: event.payload,
      hash: event.hash,
      signature: event.signature,
      parents: event.parents,
      ...((event.createdAt ?? event.created_at) ? { createdAt: event.createdAt ?? event.created_at } : {}),
    };
  }
  return args[0] ?? null;
}

function captureLegacyMutation(repository) {
  const events = [];
  let transaction;
  transaction = new Proxy(Object.create(null), {
    get(_target, property) {
      if (property === 'withTransaction') return async (callback) => callback(transaction);
      if (CAPTURED_MUTATION_METHODS.has(property)) {
        return async (...args) => {
          const cleanArgs = jsonValue(args, `captured ${property} arguments`);
          if (property === 'appendResearchEvent') events.push(cleanArgs[0]);
          return capturedReturn(property, cleanArgs);
        };
      }
      const method = repository?.[property];
      return typeof method === 'function' ? method.bind(repository) : method;
    },
  });
  return { repository: transaction, events };
}

function assertVerifiedEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new ApiResearchGraphRolloutError('dual-write planning produced no verified ResearchEvent', 'RESEARCH_GRAPH_DUAL_WRITE_EVENT_REQUIRED', 409);
  }
  for (const event of events) {
    const eventId = event?.event_id ?? event?.eventId;
    const eventType = event?.event_type ?? event?.eventType;
    if (typeof eventId !== 'string' || !eventId || typeof eventType !== 'string' || !eventType
      || !event?.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)
      || typeof event?.hash !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(event.hash)
      || !event?.signature || typeof event.signature !== 'object' || Array.isArray(event.signature)
      || !Array.isArray(event.parents)) {
      throw new ApiResearchGraphRolloutError('dual-write RPC requires complete pre-verified immutable ResearchEvents', 'RESEARCH_GRAPH_DUAL_WRITE_EVENT_INVALID', 409);
    }
  }
}

export function createApiResearchGraphRollout({
  readMode = 'legacy',
  writeMode = 'legacy',
  cutoverReady = false,
  onParity = null,
  verifyResearchEvent = null,
} = {}) {
  let modes;
  try {
    modes = resolveResearchGraphRollout({ readMode, writeMode });
  } catch (error) {
    throw new ApiResearchGraphRolloutError(error.message);
  }
  cutoverReady = asBoolean(cutoverReady, 'research graph cutover gate');
  if (onParity !== null && typeof onParity !== 'function') throw new ApiResearchGraphRolloutError('research graph parity observer must be a function or null');
  if (verifyResearchEvent !== null && typeof verifyResearchEvent !== 'function') throw new ApiResearchGraphRolloutError('research graph event verifier must be a function or null');

  async function observe(surface, identity, report) {
    if (!onParity) return;
    await onParity(Object.freeze({
      event: 'research_graph.parity',
      surface,
      identity: String(identity),
      readMode: modes.readMode,
      matches: report.matches === true,
      ...report,
    }));
  }

  return Object.freeze({
    ...modes,
    cutoverReady,

    async readCompatibility({ surface, identity, readLegacy, readKernel }) {
      const wrapped = await readResearchGraphWithShadow({
        mode: modes.readMode,
        cutoverReady,
        readLegacy: typeof readLegacy === 'function' ? async () => {
          const value = await readLegacy();
          return { ...parityEnvelope(surface, value), value };
        } : undefined,
        readKernel: typeof readKernel === 'function' ? async () => {
          const value = await readKernel();
          return { ...parityEnvelope(surface, value), value };
        } : undefined,
        onParity: (report) => observe(surface, identity, report),
      });
      return wrapped.value;
    },

    assertTypedKernelWrite() {
      if (modes.writeMode !== 'kernel') {
        throw new ApiResearchGraphRolloutError(
          'typed research writes require the explicit kernel-only cutover mode; no legacy projection exists for this entity',
          'TYPED_RESEARCH_KERNEL_CUTOVER_REQUIRED',
          409,
        );
      }
      if (!cutoverReady) throw new ApiResearchGraphRolloutError('kernel write is blocked until the project cutover gate passes', 'RESEARCH_GRAPH_CUTOVER_BLOCKED', 409);
      return true;
    },

    async executeLegacyMutation({ repository, surface, input, writeLegacy }) {
      if (typeof writeLegacy !== 'function') throw new ApiResearchGraphRolloutError('legacy mutation callback is required');
      if (modes.writeMode === 'legacy') return writeLegacy(repository);
      if (modes.writeMode === 'kernel') {
        throw new ApiResearchGraphRolloutError('legacy mutation route is disabled after kernel write cutover', 'RESEARCH_GRAPH_LEGACY_WRITE_DISABLED', 409);
      }
      if (!LEGACY_MUTATION_KINDS.has(surface)) {
        throw new ApiResearchGraphRolloutError(`unsupported legacy dual-write mutation: ${String(surface)}`, 'RESEARCH_GRAPH_DUAL_WRITE_KIND_INVALID', 400);
      }
      if (typeof repository?.executeLegacyResearchMutationDualWrite === 'function') {
        const capture = captureLegacyMutation(repository);
        const expectedLegacy = await writeLegacy(capture.repository);
        assertVerifiedEvents(capture.events);
        if (typeof verifyResearchEvent !== 'function') {
          throw new ApiResearchGraphRolloutError(
            'service-role dual write requires an injected cryptographic ResearchEvent verifier',
            'RESEARCH_GRAPH_DUAL_WRITE_VERIFIER_UNAVAILABLE',
            503,
          );
        }
        const command = jsonValue(input, 'dual-write command');
        for (const event of capture.events) {
          const verified = await verifyResearchEvent({ event, mutationKind: surface, command, repository });
          if (verified !== true) {
            throw new ApiResearchGraphRolloutError(
              'service-role dual write rejected an unverified ResearchEvent',
              'RESEARCH_GRAPH_DUAL_WRITE_EVENT_UNVERIFIED',
              409,
            );
          }
        }
        const result = await repository.executeLegacyResearchMutationDualWrite({
          mutationKind: surface,
          command,
          verifiedEvents: capture.events,
          expectedLegacy: jsonValue(expectedLegacy, 'expected legacy result'),
        });
        if (!result || result.parity !== true || !Object.hasOwn(result, 'legacy') || !Object.hasOwn(result, 'kernel')) {
          throw new ApiResearchGraphRolloutError('transactional RPC did not prove legacy/kernel parity', 'RESEARCH_GRAPH_DUAL_WRITE_MISMATCH', 409);
        }
        return result.legacy;
      }
      if (typeof repository?.mirrorLegacyResearchMutationToKernel !== 'function'
        || typeof repository?.assertLegacyResearchMutationParity !== 'function') {
        throw new ApiResearchGraphRolloutError('dual-write repository adapter is not configured', 'RESEARCH_GRAPH_DUAL_WRITE_UNAVAILABLE', 503);
      }
      const result = await executeResearchGraphWrite({
        repository,
        mode: 'dual_write',
        writeLegacy: (transaction) => writeLegacy(transactionFacade(transaction)),
        writeKernel: (transaction) => repository.mirrorLegacyResearchMutationToKernel({ transaction, surface, input }),
        assertParity: ({ legacy, kernel }) => repository.assertLegacyResearchMutationParity({ surface, input, legacy, kernel }),
      });
      return result.legacy;
    },
  });
}

export function createResearchGraphRolloutFromEnv(env = {}, { onParity = null, verifyResearchEvent = null } = {}) {
  return createApiResearchGraphRollout({
    readMode: env.RESEARCH_GRAPH_READ_MODE ?? 'legacy',
    writeMode: env.RESEARCH_GRAPH_WRITE_MODE ?? 'legacy',
    cutoverReady: env.RESEARCH_GRAPH_CUTOVER_READY ?? false,
    onParity,
    verifyResearchEvent,
  });
}

export function isResearchGraphRolloutError(error) {
  return error instanceof ApiResearchGraphRolloutError || error instanceof ResearchGraphRolloutError;
}
