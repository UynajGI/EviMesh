import { canonicalJson } from '../../../packages/protocol/src/hash.mjs';
import { verifyClientSignatureEnvelopeCryptography } from './client-signature.mjs';

const MUTATION_EVENT_TYPES = Object.freeze({
  'claim.create': 'claim.created',
  'claim.revise': 'claim.revised',
  'claim.transition': 'claim.state_changed',
  'evidence.create': 'evidence.created',
  'evidence.link': 'evidence.claim_linked',
  'verification_receipt.submit': 'verification.submitted',
  'challenge.create': 'challenge.created',
  'challenge.transition': 'challenge.state_changed',
});

const COMMAND_FIELDS = Object.freeze({
  'claim.create': Object.freeze({
    required: Object.freeze(['claimId', 'statement', 'scope', 'falsification']),
    optional: Object.freeze(['questionId', 'draftedByActorId', 'assumptions']),
  }),
  'verification_receipt.submit': Object.freeze({
    required: Object.freeze([
      'receiptId', 'runId', 'claimId', 'claimRevision', 'contractId', 'contractRevision',
      'outcome', 'verificationTypes', 'contextMode', 'sawExpectedOutputs',
      'implementationRelation', 'dataRelation', 'modelFamily', 'contributionStatementId',
    ]),
    optional: Object.freeze(['findings']),
  }),
  'challenge.create': Object.freeze({
    required: Object.freeze(['challengeId', 'targetClaimId', 'targetClaimRevision', 'reason', 'impact']),
    optional: Object.freeze(['proposedResolution']),
  }),
});

const EVENT_FIELDS = Object.freeze({
  'claim.create': Object.freeze([
    ['claim_id', 'claimId'],
    ['question_id', 'questionId'],
    ['drafted_by_actor_id', 'draftedByActorId'],
  ]),
  'verification_receipt.submit': Object.freeze([
    ['receipt_id', 'receiptId'],
    ['claim_id', 'claimId'],
    ['claim_revision', 'claimRevision'],
    ['contract_id', 'contractId'],
    ['contract_revision', 'contractRevision'],
  ]),
  'challenge.create': Object.freeze([
    ['challenge_id', 'challengeId'],
    ['target_claim_id', 'targetClaimId'],
    ['target_claim_revision', 'targetClaimRevision'],
  ]),
});

export class ResearchGraphEventVerificationError extends Error {
  constructor(message, code = 'RESEARCH_GRAPH_DUAL_WRITE_EVENT_UNVERIFIED', status = 409) {
    super(message);
    this.name = 'ResearchGraphEventVerificationError';
    this.code = code;
    this.status = status;
  }
}

function sameJson(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

function assertSame(left, right, field) {
  if (!sameJson(left, right)) {
    throw new ResearchGraphEventVerificationError(`verified ResearchEvent ${field} does not match the signed command`);
  }
}

function assertCommandEnvelopeBindings(mutationKind, command, signedPayload) {
  const fields = COMMAND_FIELDS[mutationKind];
  if (!fields) {
    throw new ResearchGraphEventVerificationError(
      `legacy ${mutationKind} requires a dedicated external-signature prepare/submit flow`,
      'RESEARCH_GRAPH_EXTERNAL_SIGNATURE_FLOW_REQUIRED',
    );
  }
  for (const field of fields.required) {
    if (!Object.hasOwn(signedPayload, field)) {
      throw new ResearchGraphEventVerificationError(`signed command payload is missing ${field}`);
    }
    assertSame(command[field], signedPayload[field], field);
  }
  for (const field of fields.optional) {
    if (Object.hasOwn(signedPayload, field)) assertSame(command[field], signedPayload[field], field);
  }
}

function assertEventBindings(mutationKind, command, payload) {
  assertSame(payload.actor_id, command.actorId, 'actor_id');
  for (const [eventField, commandField] of EVENT_FIELDS[mutationKind] ?? []) {
    assertSame(payload[eventField] ?? null, command[commandField] ?? null, eventField);
  }
  if (mutationKind === 'claim.create' || mutationKind === 'challenge.create') {
    assertSame(payload.revision, 1, 'revision');
  }
}

/**
 * Build the production verifier used immediately before the service-only
 * legacy/kernel transaction RPC. The route has already consumed the nonce;
 * this verifier repeats the public-key cryptographic check without consuming
 * it again, then binds the immutable event to the exact normalized envelope.
 */
export function createResearchGraphEventVerifier({ repository } = {}) {
  return async function verifyResearchGraphEvent({ event, mutationKind, command } = {}) {
    const expectedEventType = MUTATION_EVENT_TYPES[mutationKind];
    if (!expectedEventType) {
      throw new ResearchGraphEventVerificationError('unsupported legacy mutation kind');
    }
    if (command?.clientSignatureVerified !== true) {
      throw new ResearchGraphEventVerificationError(
        'the external human signature and nonce must be verified before dual-write planning',
        'RESEARCH_GRAPH_EXTERNAL_SIGNATURE_REQUIRED',
      );
    }
    const envelope = command.publisherSignatureEnvelope;
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      throw new ResearchGraphEventVerificationError(
        'an externally signed publisher envelope is required for this research mutation',
        'RESEARCH_GRAPH_EXTERNAL_SIGNATURE_REQUIRED',
      );
    }
    const eventType = event?.event_type ?? event?.eventType;
    if (eventType !== expectedEventType || envelope.event_type !== expectedEventType) {
      throw new ResearchGraphEventVerificationError('ResearchEvent type does not match the signed mutation');
    }
    const payload = event?.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ResearchGraphEventVerificationError('ResearchEvent payload is required');
    }
    assertCommandEnvelopeBindings(mutationKind, command, envelope.payload);
    assertEventBindings(mutationKind, command, payload);
    assertSame(payload.publisher_signature_envelope, envelope, 'publisher_signature_envelope');

    await verifyClientSignatureEnvelopeCryptography({
      repository,
      actorId: command.actorId,
      envelope,
      payload: envelope.payload,
      expectedEventType,
    });
    return true;
  };
}
