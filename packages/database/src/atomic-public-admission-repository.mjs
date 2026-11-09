const SERVICE_ROLE = 'service_role';

const NOT_FOUND_CODES = new Set(['PROJECT_APPLICATION_NOT_FOUND']);
const FORBIDDEN_CODES = new Set([
  'ACTOR_BOOTSTRAP_EMAIL_NOT_VERIFIED',
  'ACTOR_BOOTSTRAP_SERVICE_ROLE_REQUIRED',
  'PROJECT_APPLICATION_DECISION_SERVICE_ROLE_REQUIRED',
  'PROJECT_APPLICATION_STEWARD_FORBIDDEN',
  'PROJECT_APPLICATION_PLATFORM_ACTOR_INVALID',
]);
const CONFLICT_CODES = new Set([
  'ACTOR_BOOTSTRAP_BINDING_CONFLICT',
  'ACTOR_BOOTSTRAP_IDENTITY_CONFLICT',
  'PROJECT_APPLICATION_APPLICANT_INACTIVE',
  'PROJECT_APPLICATION_DECISION_REPLAY_CONFLICT',
  'PROJECT_APPLICATION_PROJECT_CONFLICT',
  'PROJECT_APPLICATION_STATE_CONFLICT',
  'RESEARCH_GRAPH_DUAL_WRITE_CROSSWALK_CONFLICT',
  'RESEARCH_GRAPH_DUAL_WRITE_EVENT_CONFLICT',
  'RESEARCH_GRAPH_DUAL_WRITE_NODE_CONFLICT',
  'RESEARCH_GRAPH_DUAL_WRITE_REVISION_CONFLICT',
]);

export class AtomicPublicAdmissionRepositoryError extends Error {
  constructor(message, code = 'ATOMIC_PUBLIC_ADMISSION_REPOSITORY_INVALID', status = 500, cause = undefined) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AtomicPublicAdmissionRepositoryError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new AtomicPublicAdmissionRepositoryError(
      `${field} must be a non-empty canonical string`,
      'ATOMIC_PUBLIC_ADMISSION_INPUT_INVALID',
      400,
    );
  }
  return value;
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AtomicPublicAdmissionRepositoryError(
      `${field} must be an object`,
      'ATOMIC_PUBLIC_ADMISSION_INPUT_INVALID',
      400,
    );
  }
  return value;
}

function requiredDecision(value) {
  if (value !== 'approved' && value !== 'rejected') {
    throw new AtomicPublicAdmissionRepositoryError(
      'decision must be approved or rejected',
      'ATOMIC_PUBLIC_ADMISSION_INPUT_INVALID',
      400,
    );
  }
  return value;
}

function assertSqlClient(sql) {
  if (typeof sql !== 'function' || typeof sql.begin !== 'function') {
    throw new AtomicPublicAdmissionRepositoryError('a Postgres.js client with begin() is required');
  }
}

function mapDatabaseError(error) {
  const message = typeof error?.message === 'string' ? error.message : 'atomic public admission failed';
  const code = /^\[([A-Z0-9_]+)]/.exec(message)?.[1] ?? 'ATOMIC_PUBLIC_ADMISSION_DATABASE_ERROR';
  const status = NOT_FOUND_CODES.has(code)
    ? 404
    : FORBIDDEN_CODES.has(code)
      ? 403
      : CONFLICT_CODES.has(code) || code.endsWith('_CONFLICT')
        ? 409
        : code.endsWith('_INVALID') || code.endsWith('_MISMATCH')
          ? 400
          : 500;
  return new AtomicPublicAdmissionRepositoryError(message, code, status, error);
}

async function asServiceRole(sql, callback) {
  return sql.begin(async (transaction) => {
    if (typeof transaction?.unsafe !== 'function') {
      throw new AtomicPublicAdmissionRepositoryError('Postgres transaction executor is invalid');
    }
    await transaction.unsafe('SET LOCAL ROLE service_role');
    const roleRows = await transaction.unsafe('SELECT current_role::text AS "currentRole"');
    if (roleRows?.[0]?.currentRole !== SERVICE_ROLE) {
      throw new AtomicPublicAdmissionRepositoryError(
        'atomic public admission must execute as service_role',
        'ATOMIC_PUBLIC_ADMISSION_SERVICE_ROLE_REQUIRED',
        403,
      );
    }
    return callback(transaction);
  });
}

function assertResult(result, schema) {
  if (!result || typeof result !== 'object' || Array.isArray(result) || result.schema !== schema) {
    throw new AtomicPublicAdmissionRepositoryError(`RPC did not return ${schema}`);
  }
  return result;
}

/**
 * The only database adapter for public-product Human bootstrap and project
 * application decisions. Auth Admin projection and platform-event signature
 * verification happen in the API before this adapter. Each method calls one
 * fixed PostgreSQL RPC; neither operation is decomposable into REST mutations.
 */
export function createAtomicPublicAdmissionRepository(sql) {
  assertSqlClient(sql);

  return Object.freeze({
    actorBootstrapReady: true,
    atomicProjectDecisionReady: true,
    usesPlatformGovernanceEvent: true,

    async bootstrapHumanActor({ authoritativeClaims } = {}) {
      authoritativeClaims = requiredObject(authoritativeClaims, 'authoritative Auth claims');
      try {
        return await asServiceRole(sql, async (transaction) => {
          const rows = await transaction.unsafe(
            'SELECT public.actor_self_bootstrap($1::jsonb) AS result',
            [authoritativeClaims],
          );
          return assertResult(rows?.[0]?.result, 'evimesh.actor-bootstrap-result.v1');
        });
      } catch (error) {
        if (error instanceof AtomicPublicAdmissionRepositoryError) throw error;
        throw mapDatabaseError(error);
      }
    },

    async decideProjectApplicationAtomic({
      applicationId,
      stewardActorId,
      decision,
      reason,
      decidedAt,
      platformActorId,
      platformEvent,
    } = {}) {
      applicationId = requiredText(applicationId, 'application id');
      stewardActorId = requiredText(stewardActorId, 'steward Actor id');
      decision = requiredDecision(decision);
      reason = requiredText(reason, 'decision reason');
      decidedAt = requiredText(decidedAt, 'decision timestamp');
      platformActorId = requiredText(platformActorId, 'platform governance Actor id');
      platformEvent = requiredObject(platformEvent, 'platform governance ResearchEvent');
      try {
        return await asServiceRole(sql, async (transaction) => {
          const rows = await transaction.unsafe(
            'SELECT public.project_application_decide_atomic($1::uuid,$2::text,$3::text,$4::text,$5::timestamptz,$6::text,$7::jsonb) AS result',
            [applicationId, stewardActorId, decision, reason, decidedAt, platformActorId, platformEvent],
          );
          return assertResult(rows?.[0]?.result, 'evimesh.project-application-decision-result.v1');
        });
      } catch (error) {
        if (error instanceof AtomicPublicAdmissionRepositoryError) throw error;
        throw mapDatabaseError(error);
      }
    },
  });
}
