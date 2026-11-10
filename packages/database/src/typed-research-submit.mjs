const SERVICE_ROLE = 'service_role';

const CONFLICT_CODES = new Set([
  'TYPED_RESEARCH_REPLAY_CONFLICT',
  'TYPED_RESEARCH_SIGNATURE_REPLAYED',
  'TYPED_RESEARCH_DANGLING_SOURCE',
  'TYPED_RESEARCH_TARGET_REVISION_EXISTS',
  'TYPED_RESEARCH_NODE_EXISTS',
  'TYPED_RESEARCH_NODE_IDENTITY_MISMATCH',
  'TYPED_RESEARCH_REVISION_RACE',
]);

const FORBIDDEN_CODES = new Set([
  'TYPED_RESEARCH_SERVICE_ROLE_REQUIRED',
  'TYPED_RESEARCH_AGENT_INVALID',
  'TYPED_RESEARCH_PUBLISHER_OWNERSHIP_MISMATCH',
  'TYPED_RESEARCH_PUBLISHER_INVALID',
  'TYPED_RESEARCH_SIGNING_KEY_INVALID',
  'TYPED_RESEARCH_PROJECT_INVALID',
  'TYPED_RESEARCH_PROJECT_ROLE_FORBIDDEN',
]);

export class TypedResearchSubmitRepositoryError extends Error {
  constructor(message, code = 'TYPED_RESEARCH_SUBMIT_REPOSITORY_INVALID', status = 500, cause = undefined) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'TypedResearchSubmitRepositoryError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim() !== value) {
    throw new TypedResearchSubmitRepositoryError(`${field} must be a non-empty canonical string`, 'TYPED_RESEARCH_SUBMIT_INPUT_INVALID', 400);
  }
  return value;
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypedResearchSubmitRepositoryError(`${field} must be an object`, 'TYPED_RESEARCH_SUBMIT_INPUT_INVALID', 400);
  }
  return value;
}

function assertSqlClient(sql) {
  if (typeof sql !== 'function' || typeof sql.begin !== 'function') {
    throw new TypedResearchSubmitRepositoryError('a Postgres.js client with begin() is required');
  }
}

function mapDatabaseError(error) {
  const message = typeof error?.message === 'string' ? error.message : 'typed research submission failed';
  const code = /^\[([A-Z0-9_]+)]/.exec(message)?.[1] ?? 'TYPED_RESEARCH_SUBMIT_DATABASE_ERROR';
  const status = CONFLICT_CODES.has(code) || code.endsWith('_CONFLICT')
    ? 409
    : FORBIDDEN_CODES.has(code)
      ? 403
      : code.endsWith('_INVALID') || code.includes('MISMATCH')
        ? 400
        : 500;
  return new TypedResearchSubmitRepositoryError(message, code, status, error);
}

/**
 * Call the only production PostgreSQL mutation surface for Answer, Rebuttal,
 * Evaluation, Dataset, and Tool revisions. Cryptographic verification and
 * platform event signing happen before this adapter; PostgreSQL re-validates
 * attribution, exact active key ownership, nonce/idempotency, typed motif,
 * immutable sources, and atomic persistence.
 */
export function createTypedResearchSubmitRepository(sql) {
  assertSqlClient(sql);
  return Object.freeze({
    async executeTypedResearchSubmit({ agentActorId, signatureEnvelope, platformEvent } = {}) {
      agentActorId = requiredText(agentActorId, 'Agent actor id');
      signatureEnvelope = requiredObject(signatureEnvelope, 'signature envelope');
      platformEvent = requiredObject(platformEvent, 'platform ResearchEvent');
      try {
        return await sql.begin(async (transaction) => {
          if (typeof transaction.unsafe !== 'function') {
            throw new TypedResearchSubmitRepositoryError('Postgres transaction executor is invalid');
          }
          await transaction.unsafe('SET LOCAL ROLE service_role');
          const roleRows = await transaction.unsafe('SELECT current_role::text AS "currentRole"');
          if (roleRows?.[0]?.currentRole !== SERVICE_ROLE) {
            throw new TypedResearchSubmitRepositoryError(
              'typed research submission must execute as service_role',
              'TYPED_RESEARCH_SERVICE_ROLE_REQUIRED',
              403,
            );
          }
          const rows = await transaction.unsafe(
            'SELECT public.execute_typed_research_submit($1::text,$2::jsonb,$3::jsonb) AS result',
            [agentActorId, signatureEnvelope, platformEvent],
          );
          const result = rows?.[0]?.result;
          if (!result || typeof result !== 'object' || Array.isArray(result)) {
            throw new TypedResearchSubmitRepositoryError('typed research submit RPC returned an invalid result');
          }
          return result;
        });
      } catch (error) {
        if (error instanceof TypedResearchSubmitRepositoryError) throw error;
        throw mapDatabaseError(error);
      }
    },
  });
}
