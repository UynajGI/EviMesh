import { Hono } from "hono";
import { cors } from "hono/cors";
import { createSupabaseReadRepository } from "./supabase-read-repository.mjs";
import { authenticateSupabaseRequest, JwtVerificationError } from "./jwt.mjs";
import { ContextQueryError, getTaskContext } from "./context-query.mjs";
import { RequestValidationError } from "./validation.mjs";
import { getPlatformPublicKeys, PlatformPublicKeysError } from './platform-public-keys.mjs';
import { getOwnProfile, patchOwnProfile } from './profile-api.mjs';
import { ActorIdentityError, resolveActorForSupabaseClaims } from './actor-identity.mjs';
import { recordInteraction, removeInteraction, listMyInteractions, getMyRecommendations, provisionSelfActor } from './interaction-query.mjs';
import { ActorProfileError } from '../../../packages/domain/src/actor-profile.mjs';
import { ProjectAuthorizationError } from '../../../packages/domain/src/project-authorization.mjs';
import { registerOwnSigningKey } from './signing-key-api.mjs';
import { SigningKeyError } from '../../../packages/domain/src/signing-key.mjs';
import { listOwnTokens, createOwnToken, revokeOwnToken } from './api-token-api.mjs';
import { ApiTokenError } from '../../../packages/domain/src/api-token.mjs';
import { getQuestion, listQuestions, QuestionQueryError } from './question-query.mjs';
import { getClaim, getClaimDownstreamGraph, getClaimRevision, getClaimUpstreamGraph, listClaims, ClaimQueryError } from './claim-query.mjs';
import { getProject, listProjects, ProjectQueryError } from './project-query.mjs';
import { getLatestFrontier, listFrontierHistory, diffFrontiers, FrontierQueryError } from './frontier-query.mjs';
import { getTask, listTasks, TaskQueryError } from './task-query.mjs';
import { getArtifact, getArtifactRevision, listArtifacts, ArtifactQueryError } from './artifact-query.mjs';
import { getEvidence, listEvidence, EvidenceQueryError } from './evidence-query.mjs';
import { getRun, listRuns, RunQueryError } from './run-query.mjs';
import { getChallenge, ChallengeQueryError } from './challenge-query.mjs';
import { getAttempt, AttemptQueryError } from './attempt-query.mjs';
import { getContribution, listActors, ContributionQueryError } from './contribution-query.mjs';
import { listResearchEvents, ResearchEventQueryError } from './research-event-query.mjs';
import { exportResearchEventRangeNdjson, ResearchEventExportError } from './research-event-export.mjs';
import { getResearchEventInclusionProof, ResearchEventProofError } from './research-event-proof.mjs';
import { getMerkleCheckpoint, MerkleCheckpointQueryError } from './merkle-checkpoint-query.mjs';
import { getMergeProposal, MergeProposalQueryError } from './merge-proposal-query.mjs';
import { getObjectProvenance, ObjectProvenanceQueryError } from './object-provenance-query.mjs';
import { getVerificationReceipt, listClaimVerifications, VerificationQueryError } from './verification-query.mjs';
import { prepareVerification, VerificationPrepareError } from './verification-prepare.mjs';
import { revisionEtag } from './etag.mjs';
import { semanticHash } from '../../../packages/protocol/src/hash.mjs';
import { createProject, reviseProject } from '../../../packages/domain/src/project-command.mjs';
import { ProjectCommandError } from '../../../packages/domain/src/project-command.mjs';
import { createQuestion, transitionQuestion } from '../../../packages/domain/src/question-command.mjs';
import { QuestionCommandError } from '../../../packages/domain/src/question-command.mjs';
import { acquireTaskLease, createAttempt, createTask, createTraceEvent, releaseTaskLease, transitionAttempt, TaskCommandError } from '../../../packages/domain/src/task-command.mjs';
import { createClaim, reviseClaim, transitionClaim, ClaimCommandError } from '../../../packages/domain/src/claim-command.mjs';
import { createEvidence, linkEvidenceClaim, EvidenceCommandError } from '../../../packages/domain/src/evidence-command.mjs';
import { createRun, RunCommandError } from '../../../packages/domain/src/run-command.mjs';
import { createArtifact, ArtifactCommandError } from '../../../packages/domain/src/artifact-command.mjs';
import { createChallenge, transitionChallenge, ChallengeCommandError } from '../../../packages/domain/src/challenge-command.mjs';
import { submitVerification, VerificationSubmitError } from '../../../packages/domain/src/verification-submit-command.mjs';
import { createSingleUploadPlan, UploadSessionError } from '../../../packages/artifact/src/upload-session.mjs';
import { createActorApiToken, ApiTokenError as DeviceTokenError } from '../../../packages/domain/src/api-token.mjs';
import { approveDeviceAuthorization, CLI_DEVICE_SCOPES, createMemoryDeviceCodeStore, DeviceAuthError, exchangeDeviceToken, startDeviceAuthorization } from './device-auth.mjs';
import { verifyClientSignatureEnvelope } from './client-signature.mjs';
import { API_TOKEN_PREFIX, authenticateApiToken } from './api-token-auth.mjs';
import { importWitnessReceipt, WitnessError } from '../../../packages/frontier-bundle/src/witness.mjs';
import { createRateLimiter, rateLimitSettings } from './rate-limit.mjs';
import { createDurableObjectRateLimiter } from './rate-limit-binding.mjs';
import { createSupabaseNonceStore } from './supabase-nonce-store.mjs';


const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const authenticatedRequestClaims = new WeakMap();

function configuredCorsOrigins(env) {
  return String(env?.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function requestIdFor(value) {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value) ? value : crypto.randomUUID();
}

function errorBody(code, message, requestId) {
  return { code, message, request_id: requestId };
}

export function createApp({ repository = null, signatureNonceStore = null, projectEventFactory = null, questionEventFactory = null, questionRoleResolver = null, questionRiskResolver = null, attemptEventFactory = null, attemptRoleResolver = null, leaseEventFactory = null, leaseRoleResolver = null, taskEventFactory = null, taskRoleResolver = null, claimEventFactory = null, claimRoleResolver = null, evidenceEventFactory = null, evidenceRoleResolver = null, runEventFactory = null, runRoleResolver = null, artifactEventFactory = null, artifactRoleResolver = null, challengeEventFactory = null, challengeRoleResolver = null, verificationEventFactory = null, verificationRoleResolver = null, uploadSigner = null, deviceCodeStore = createMemoryDeviceCodeStore(), authenticate = authenticateSupabaseRequest, rateLimiter = createRateLimiter() } = {}) {
const app = new Hono();

function rateLimiterFor(context) {
  return context.env?.RATE_LIMITER
    ? createDurableObjectRateLimiter(context.env.RATE_LIMITER)
    : rateLimiter;
}

function nonceStoreFor(context) {
  if (typeof signatureNonceStore?.claimSignatureNonce === 'function') return signatureNonceStore;
  if (typeof repository?.claimSignatureNonce === 'function') return repository;
  return createSupabaseNonceStore({ env: context.env });
}

function revisionEtagFor(objectId, revision) {
  return revisionEtag({ objectId, revision: revision.revision, contentHash: semanticHash(revision) });
}

function knownFailure(error, context, fallback) {
  if (error instanceof JwtVerificationError) return context.json(errorBody("unauthorized", "authentication required", context.get("requestId")), 401);
  if (error instanceof SyntaxError) return context.json(errorBody("invalid_json", "request body must be valid JSON", context.get("requestId")), 400);
  if (error instanceof ProjectAuthorizationError) return context.json(errorBody(error.code, error.message, context.get("requestId")), 403);
  if (error instanceof Error && typeof error.status === "number" && typeof error.code === "string") {
    return context.json(errorBody(error.code, error.message, context.get("requestId")), error.status);
  }
  if (typeof fallback === "number") return context.json(errorBody("command_failed", error.message, context.get("requestId")), fallback);
  return null;
}

/** Accept either a Supabase JWT or an `evimesh_...` API token as Bearer credentials. */
async function authenticateRequest(request, env) {
  const cachedClaims = request && authenticatedRequestClaims.get(request);
  if (cachedClaims) return cachedClaims;
  const header = request?.headers?.get?.("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  let claims;
  if (match && match[1].startsWith(API_TOKEN_PREFIX)) {
    claims = await authenticateApiToken({ repository, token: match[1] });
  } else {
    claims = await authenticate(request, env);
  }
  if (request && claims) authenticatedRequestClaims.set(request, claims);
  return claims;
}

app.use("*", async (context, next) => {
  const requestId = requestIdFor(context.req.header("x-request-id"));
  context.set("requestId", requestId);
  context.header("x-request-id", requestId);
  await next();
});

app.use("*", async (context, next) => {
  // Preserve anonymous public-route behavior: only valid Bearer credentials
  // enter an identity bucket. Protected handlers still authenticate themselves.
  if (!/^Bearer\s+/i.test(context.req.header('authorization') ?? '')) return next();

  let claims;
  let actorId;
  try {
    claims = await authenticateRequest(context.req.raw, context.env);
    actorId = await resolveActorForSupabaseClaims({ repository, claims });
  } catch {
    return next();
  }

  const settings = rateLimitSettings(context.env);
  const activeRateLimiter = rateLimiterFor(context);
  const actorResult = await activeRateLimiter.consume({
    scope: 'actor', key: actorId, limit: settings.actorLimit, windowMs: settings.windowMs,
  });
  if (!actorResult.allowed) {
    context.header('retry-after', String(actorResult.retryAfterSeconds));
    return context.json(errorBody('RATE_LIMITED', 'request rate limit exceeded', context.get('requestId')), 429);
  }

  if (claims.kind === 'api_token' && typeof claims.tokenId === 'string' && claims.tokenId) {
    const tokenResult = await activeRateLimiter.consume({
      scope: 'api_token', key: claims.tokenId, limit: settings.apiTokenLimit, windowMs: settings.windowMs,
    });
    if (!tokenResult.allowed) {
      context.header('retry-after', String(tokenResult.retryAfterSeconds));
      return context.json(errorBody('RATE_LIMITED', 'request rate limit exceeded', context.get('requestId')), 429);
    }
  }
  return next();
});

app.use("*", async (context, next) => {
  const startedAt = Date.now();
  try {
    await next();
  } finally {
    console.log(JSON.stringify({
      event: "api.request",
      method: context.req.method,
      path: new URL(context.req.url).pathname,
      status: context.res.status,
      request_id: context.get("requestId"),
      duration_ms: Date.now() - startedAt,
    }));
  }
});

app.use("*", cors({
  origin: (origin, context) => configuredCorsOrigins(context.env).includes(origin) ? origin : null,
  exposeHeaders: ["ETag", "Location", "X-Request-ID"],
  maxAge: 600,
}));

app.get("/health", (context) => context.json({
  service: "evimesh-api-edge",
  status: "ok",
  environment: context.env.EVIMESH_ENV ?? "development",
}));

app.get('/platform/keys', (context) => {
  try {
    const keyring = JSON.parse(context.env?.PLATFORM_KEYRING ?? '');
    return context.json(getPlatformPublicKeys({ keyring }));
  } catch (error) {
    if (error instanceof PlatformPublicKeysError || error instanceof SyntaxError) {
      return context.json(errorBody('platform_keys_unavailable', 'platform public keys are unavailable', context.get('requestId')), 503);
    }
    throw error;
  }
});

app.get("/auth/me", async (context) => {
  try {
    const claims = await authenticateRequest(context.req.raw, context.env);
    return context.json({ subject: claims.sub, email: claims.email ?? null });
  } catch (error) {
    if (error instanceof JwtVerificationError || error instanceof SyntaxError) {
      return context.json(errorBody("unauthorized", "authentication required", context.get("requestId")), 401);
    }
    throw error;
  }
});

function deviceFailure(error, context) {
  if (error instanceof DeviceAuthError) {
    return context.json({ error: error.code.toLowerCase(), error_description: error.message }, error.status);
  }
  return null;
}

app.post("/auth/device", async (context) => {
  try {
    const body = await context.req.json().catch(() => ({}));
    return context.json(await startDeviceAuthorization({ store: deviceCodeStore, clientId: body.client_id }));
  } catch (error) {
    return deviceFailure(error, context) ?? deviceFailure(new DeviceAuthError(error.message, "INVALID_REQUEST"), context);
  }
});

app.post("/auth/device/approve", async (context) => {
  try {
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json().catch(() => ({}));
    return context.json(await approveDeviceAuthorization({ store: deviceCodeStore, actorId, userCode: body.user_code }));
  } catch (error) {
    const device = deviceFailure(error, context);
    if (device) return device;
    const response = knownFailure(error, context);
    if (response) return response;
    throw error;
  }
});

app.post("/auth/device/token", async (context) => {
  try {
    const body = await context.req.json().catch(() => ({}));
    const issueToken = async (actorId) => {
      if (!repository || typeof repository.insertApiToken !== "function") {
        throw new DeviceAuthError("device token issuance is not configured", "DEVICE_AUTH_TOKEN_UNAVAILABLE", 503);
      }
      try {
        const { token, record } = await createActorApiToken({ repository, actorId, scopes: [...CLI_DEVICE_SCOPES] });
        return { access_token: token, scopes: [...CLI_DEVICE_SCOPES], token_id: record?.tokenId ?? null };
      } catch (error) {
        if (error instanceof DeviceTokenError) throw new DeviceAuthError(error.message, "DEVICE_AUTH_TOKEN_UNAVAILABLE", 503);
        throw error;
      }
    };
    return context.json(await exchangeDeviceToken({ store: deviceCodeStore, deviceCode: body.device_code, issueToken }));
  } catch (error) {
    return deviceFailure(error, context) ?? deviceFailure(new DeviceAuthError(error.message, "INVALID_REQUEST"), context);
  }
});

app.post('/witness-receipts', async (context) => {
  try {
    const body = await context.req.json().catch(() => ({}));
    const stored = await importWitnessReceipt({ repository, receipt: body.receipt ?? body, publicKey: body.publicKey });
    return context.json({ witnessReceiptId: stored.witnessReceiptId, checkpointId: stored.checkpointId, witnessId: stored.witnessId }, 201);
  } catch (error) {
    if (error instanceof WitnessError) {
      const status = error.code === 'WITNESS_CHECKPOINT_NOT_FOUND' ? 404 : error.code === 'WITNESS_IMPORT_UNAVAILABLE' ? 503 : 400;
      return context.json(errorBody(error.code, error.message, context.get('requestId')), status);
    }
    throw error;
  }
});

app.get('/questions', async (context) => {
  try {
    const requestedLimit = context.req.query('limit');
    const limit = requestedLimit === undefined ? 20 : Number(requestedLimit);
    return context.json(await listQuestions({
      repository,
      projectId: context.req.query('projectId') ?? null,
      state: context.req.query('state') ?? null,
      limit,
      cursor: context.req.query('cursor') ?? null,
    }));
  } catch (error) {
    if (error instanceof QuestionQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/questions/:questionId', async (context) => {
  try {
    return context.json(await getQuestion({ repository, questionId: context.req.param('questionId') }));
  } catch (error) {
    if (error instanceof QuestionQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/claims', async (context) => {
  try {
    const requestedLimit = context.req.query('limit');
    const limit = requestedLimit === undefined ? 20 : Number(requestedLimit);
    return context.json(await listClaims({
      repository,
      projectId: context.req.query('projectId') ?? null,
      status: context.req.query('status') ?? null,
      tag: context.req.query('tag') ?? null,
      limit,
      cursor: context.req.query('cursor') ?? null,
    }));
  } catch (error) {
    if (error instanceof ClaimQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/claims/:claimId', async (context) => {
  try {
    const claimId = context.req.param('claimId');
    const detail = await getClaim({ repository, claimId });
    return context.json({ ...detail, etag: revisionEtagFor(claimId, detail.currentRevision) });
  } catch (error) {
    if (error instanceof ClaimQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/claims/:claimId/graph', async (context) => {
  try {
    const maxDepth = context.req.query('maxDepth') === undefined ? 3 : Number(context.req.query('maxDepth'));
    const query = { repository, claimId: context.req.param('claimId'), maxDepth };
    if (context.req.query('direction') === 'upstream') return context.json(await getClaimUpstreamGraph(query));
    if (context.req.query('direction') === 'downstream' || context.req.query('direction') === undefined) return context.json(await getClaimDownstreamGraph(query));
    throw new ClaimQueryError('graph direction must be upstream or downstream');
  } catch (error) {
    if (error instanceof ClaimQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/claims/:claimId/revisions/:revision', async (context) => {
  try {
    return context.json({ claimRevision: await getClaimRevision({ repository, claimId: context.req.param('claimId'), revision: Number(context.req.param('revision')) }) });
  } catch (error) {
    if (error instanceof ClaimQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/projects', async (context) => {
  try {
    const requestedLimit = context.req.query('limit');
    const limit = requestedLimit === undefined ? 20 : Number(requestedLimit);
    return context.json(await listProjects({ repository, state: context.req.query('state') ?? null, limit, cursor: context.req.query('cursor') ?? null }));
  } catch (error) {
    if (error instanceof ProjectQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/projects/:projectId', async (context) => {
  try {
    const projectId = context.req.param('projectId');
    const detail = await getProject({ repository, projectId });
    return context.json({ ...detail, etag: revisionEtagFor(projectId, detail.currentRevision) });
  } catch (error) { if (error instanceof ProjectQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
});

app.get('/projects/:projectId/frontier/latest', async (context) => {
  try {
    return context.json({ frontier: await getLatestFrontier({ repository, projectId: context.req.param('projectId') }) });
  } catch (error) {
    if (error instanceof FrontierQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/projects/:projectId/frontier/history', async (context) => {
  try {
    const limit = context.req.query('limit') === undefined ? 20 : Number(context.req.query('limit'));
    return context.json(await listFrontierHistory({ repository, projectId: context.req.param('projectId'), limit, cursor: context.req.query('cursor') ?? null }));
  } catch (error) {
    if (error instanceof FrontierQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.post('/projects', async (context) => {
  try {
    if (typeof projectEventFactory !== 'function') {
      return context.json(errorBody('PROJECT_CREATION_UNAVAILABLE', 'project creation is not configured', context.get('requestId')), 503);
    }
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json();
    return context.json(await createProject({
      repository,
      actorId,
      projectId: body.projectId,
      name: body.name,
      summary: body.summary,
      license: body.license,
      maintainerIds: body.maintainerIds ?? [],
      eventFactory: projectEventFactory,
    }), 201);
  } catch (error) {
    const status = error instanceof JwtVerificationError ? 401 : error instanceof ActorIdentityError ? error.status : error instanceof ProjectCommandError ? error.status : error.status;
    if (status) return context.json(errorBody(error.code ?? 'project_creation_failed', error.message, context.get('requestId')), status);
    throw error;
  }
});

app.post('/questions', async (context) => {
  try {
    if (typeof questionEventFactory !== 'function' || typeof questionRoleResolver !== 'function') {
      return context.json(errorBody('QUESTION_CREATION_UNAVAILABLE', 'question creation is not configured', context.get('requestId')), 503);
    }
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json();
    const actorRole = await questionRoleResolver({ repository, actorId, projectId: body.projectId });
    const result = await createQuestion({
      repository,
      actorId,
      actorRole,
      questionId: body.questionId,
      projectId: body.projectId,
      title: body.title,
      statement: body.statement,
      topics: body.topics,
      researchContract: body.researchContract,
      eventFactory: questionEventFactory,
    });
    return context.json(result, 201);
  } catch (error) {
    const status = error instanceof JwtVerificationError ? 401 : error instanceof ActorIdentityError ? error.status : error instanceof QuestionCommandError ? error.status : error.status;
    if (status) return context.json(errorBody(error.code ?? 'question_creation_failed', error.message, context.get('requestId')), status);
    throw error;
  }
});

app.get('/tasks', async (context) => {
  try {
    const requestedLimit = context.req.query('limit');
    const limit = requestedLimit === undefined ? 20 : Number(requestedLimit);
    return context.json(await listTasks({
      repository,
      projectId: context.req.query('projectId') ?? null,
      status: context.req.query('status') ?? null,
      type: context.req.query('type') ?? null,
      tag: context.req.query('tag') ?? null,
      limit,
      cursor: context.req.query('cursor') ?? null,
    }));
  } catch (error) {
    if (error instanceof TaskQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/tasks/:taskId', async (context) => {
  try {
    const taskId = context.req.param('taskId');
    const detail = await getTask({ repository, taskId });
    return context.json({ ...detail, etag: revisionEtagFor(taskId, detail.currentRevision) });
  } catch (error) {
    if (error instanceof TaskQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.post('/tasks/:taskId/attempts', async (context) => {
  try {
    if (typeof attemptEventFactory !== 'function' || typeof attemptRoleResolver !== 'function') {
      return context.json(errorBody('ATTEMPT_CREATION_UNAVAILABLE', 'attempt creation is not configured', context.get('requestId')), 503);
    }
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json();
    const actorRole = await attemptRoleResolver({ repository, actorId, taskId: context.req.param('taskId') });
    const result = await createAttempt({
      repository,
      actorId,
      actorRole,
      attemptId: body.attemptId,
      taskId: context.req.param('taskId'),
      contextBundleId: body.contextBundleId,
      contextMode: body.contextMode,
      eventFactory: attemptEventFactory,
    });
    return context.json(result, 201);
  } catch (error) {
    const status = error instanceof JwtVerificationError ? 401 : error instanceof ActorIdentityError ? error.status : error instanceof ProjectAuthorizationError ? 403 : error instanceof TaskCommandError ? error.status : error.status;
    if (status) return context.json(errorBody(error.code ?? 'attempt_creation_failed', error.message, context.get('requestId')), status);
    throw error;
  }
});

app.post('/tasks/:taskId/lease', async (context) => {
  try {
    if (typeof leaseEventFactory !== 'function' || typeof leaseRoleResolver !== 'function') return context.json(errorBody('LEASE_OPERATION_UNAVAILABLE', 'lease operations are not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json().catch(() => ({}));
    const actorRole = await leaseRoleResolver({ repository, actorId, taskId: context.req.param('taskId') });
    return context.json(await acquireTaskLease({ repository, actorId, actorRole, taskId: context.req.param('taskId'), leaseDurationMs: body.leaseDurationMs ?? undefined, eventFactory: leaseEventFactory }), 201);
  } catch (error) {
    const status = error instanceof JwtVerificationError ? 401 : error instanceof ActorIdentityError ? error.status : error instanceof ProjectAuthorizationError ? 403 : error instanceof TaskCommandError ? error.status : error.status;
    if (status) return context.json(errorBody(error.code ?? 'lease_operation_failed', error.message, context.get('requestId')), status);
    throw error;
  }
});

app.delete('/tasks/:taskId/lease', async (context) => {
  try {
    if (typeof leaseEventFactory !== 'function' || typeof leaseRoleResolver !== 'function') return context.json(errorBody('LEASE_OPERATION_UNAVAILABLE', 'lease operations are not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const actorRole = await leaseRoleResolver({ repository, actorId, taskId: context.req.param('taskId') });
    return context.json(await releaseTaskLease({ repository, actorId, actorRole, taskId: context.req.param('taskId'), eventFactory: leaseEventFactory }));
  } catch (error) {
    const status = error instanceof JwtVerificationError ? 401 : error instanceof ActorIdentityError ? error.status : error instanceof TaskCommandError ? error.status : error.status;
    if (status) return context.json(errorBody(error.code ?? 'lease_operation_failed', error.message, context.get('requestId')), status);
    throw error;
  }
});

app.get('/profile', async (context) => {
  try {
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    return context.json(await getOwnProfile({ repository, actorId }));
  } catch (error) {
    const status = error instanceof JwtVerificationError ? 401 : error instanceof ActorIdentityError ? error.status : error instanceof ActorProfileError ? 400 : error.status;
    if (status) return context.json(errorBody(error.code ?? 'profile_unavailable', error.message, context.get('requestId')), status);
    throw error;
  }
});

app.patch('/profile', async (context) => {
  try {
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const patch = await context.req.json();
    return context.json(await patchOwnProfile({ repository, actorId, patch }));
  } catch (error) {
    const status = error instanceof JwtVerificationError ? 401 : error instanceof ActorIdentityError ? error.status : error instanceof ActorProfileError ? 400 : error.status;
    if (status) return context.json(errorBody(error.code ?? 'profile_unavailable', error.message, context.get('requestId')), status);
    throw error;
  }
});

/* Engagement signals + personal recommendations (owner direction 2026-08-21).
 * Writes forward the caller's Supabase JWT to PostgREST; RLS pins rows to
 * the authenticated identity. Signal kinds stay private navigation input —
 * responses never include aggregate counts or scores. */
function bearerTokenOf(request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
  return match ? match[1] : null;
}

async function authedActorFor(context) {
  const accessToken = bearerTokenOf(context.req.raw);
  const claims = await authenticateRequest(context.req.raw, context.env);
  const actorId = await resolveActorForSupabaseClaims({ repository, claims, ...(accessToken ? { accessToken } : {}) });
  return { actorId, accessToken };
}

app.post('/actors/self', async (context) => {
  try {
    const claims = await authenticateRequest(context.req.raw, context.env);
    return context.json(await provisionSelfActor({ repository, claims, accessToken: bearerTokenOf(context.req.raw) }), 201);
  } catch (error) { const response = knownFailure(error, context); if (response) return response; throw error; }
});

app.put('/interactions/:objectType/:objectId', async (context) => {
  try {
    const { actorId, accessToken } = await authedActorFor(context);
    const { kind } = await context.req.json();
    return context.json(await recordInteraction({ repository, accessToken, actorId, objectType: context.req.param('objectType'), objectId: context.req.param('objectId'), kind }));
  } catch (error) { const response = knownFailure(error, context); if (response) return response; throw error; }
});

app.delete('/interactions/:objectType/:objectId', async (context) => {
  try {
    const { actorId, accessToken } = await authedActorFor(context);
    const kind = context.req.query('kind') ?? 'helpful';
    return context.json(await removeInteraction({ repository, accessToken, actorId, objectType: context.req.param('objectType'), objectId: context.req.param('objectId'), kind }));
  } catch (error) { const response = knownFailure(error, context); if (response) return response; throw error; }
});

app.get('/interactions/mine', async (context) => {
  try {
    const { actorId, accessToken } = await authedActorFor(context);
    const kinds = context.req.query('kind') ? context.req.query('kind').split(',').map((entry) => entry.trim()).filter(Boolean) : null;
    return context.json({ interactions: await listMyInteractions({ repository, accessToken, actorId, kinds }) });
  } catch (error) { const response = knownFailure(error, context); if (response) return response; throw error; }
});

app.get('/recommendations', async (context) => {
  try {
    const { actorId, accessToken } = await authedActorFor(context);
    const limit = Number.parseInt(context.req.query('limit') ?? '12', 10);
    return context.json(await getMyRecommendations({ repository, accessToken, actorId, limit: Number.isInteger(limit) ? limit : 12 }));
  } catch (error) { const response = knownFailure(error, context); if (response) return response; throw error; }
});

app.post('/signing-keys', async (context) => {
  try {
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const { keyId, publicKey } = await context.req.json();
    return context.json(await registerOwnSigningKey({ repository, actorId, keyId, publicKey }), 201);
  } catch (error) {
    const status = error instanceof JwtVerificationError ? 401 : error instanceof ActorIdentityError ? error.status : error instanceof SigningKeyError ? 400 : error.status;
    if (status) return context.json(errorBody(error.code ?? 'signing_key_unavailable', error.message, context.get('requestId')), status);
    throw error;
  }
});

async function actorFor(context) { return resolveActorForSupabaseClaims({ repository, claims: await authenticateRequest(context.req.raw, context.env) }); }
function tokenFailure(error, context) { const status = error instanceof JwtVerificationError ? 401 : error instanceof ActorIdentityError ? error.status : error instanceof ApiTokenError ? 400 : error.status; return status ? context.json(errorBody(error.code ?? 'api_token_unavailable', error.message, context.get('requestId')), status) : null; }
app.get('/api-tokens', async (context) => { try { return context.json(await listOwnTokens({ repository, actorId: await actorFor(context) })); } catch (error) { const response = tokenFailure(error, context); if (response) return response; throw error; } });
app.post('/api-tokens', async (context) => { try { const { scopes = [], expiresAt = null } = await context.req.json(); return context.json(await createOwnToken({ repository, actorId: await actorFor(context), scopes, expiresAt }), 201); } catch (error) { const response = tokenFailure(error, context); if (response) return response; throw error; } });
app.delete('/api-tokens/:tokenId', async (context) => { try { return context.json(await revokeOwnToken({ repository, actorId: await actorFor(context), tokenId: context.req.param('tokenId') })); } catch (error) { const response = tokenFailure(error, context); if (response) return response; throw error; } });

app.get("/tasks/:taskId/context", async (context) => {
  try {
    const contextBundle = await getTaskContext({ repository, taskId: context.req.param("taskId"), mode: context.req.query("mode") });
    return context.json(contextBundle);
  } catch (error) {
    if (error instanceof ContextQueryError) {
      return context.json(errorBody(error.code, error.message, context.get("requestId")), error.status);
    }
    throw error;
  }
});

function pagedLimit(context) {
  const requestedLimit = context.req.query('limit');
  return requestedLimit === undefined ? 20 : Number(requestedLimit);
}

app.get('/artifacts', async (context) => {
  try {
    return context.json(await listArtifacts({ repository, artifactType: context.req.query('artifactType') ?? null, createdBy: context.req.query('createdBy') ?? null, limit: pagedLimit(context), cursor: context.req.query('cursor') ?? null }));
  } catch (error) {
    if (error instanceof ArtifactQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/artifacts/:artifactId', async (context) => {
  try { return context.json(await getArtifact({ repository, artifactId: context.req.param('artifactId') })); }
  catch (error) { if (error instanceof ArtifactQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
});

app.get('/artifacts/:artifactId/revisions/:revision', async (context) => {
  try {
    return context.json({ artifactRevision: await getArtifactRevision({ repository, artifactId: context.req.param('artifactId'), revision: Number(context.req.param('revision')) }) });
  } catch (error) {
    if (error instanceof ArtifactQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/evidence', async (context) => {
  try {
    return context.json(await listEvidence({ repository, evidenceType: context.req.query('evidenceType') ?? null, claimId: context.req.query('claimId') ?? null, limit: pagedLimit(context), cursor: context.req.query('cursor') ?? null }));
  } catch (error) {
    if (error instanceof EvidenceQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/evidence/:evidenceId', async (context) => {
  try { return context.json(await getEvidence({ repository, evidenceId: context.req.param('evidenceId') })); }
  catch (error) { if (error instanceof EvidenceQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
});

app.get('/runs', async (context) => {
  try {
    return context.json(await listRuns({ repository, taskId: context.req.query('taskId') ?? null, actorId: context.req.query('actorId') ?? null, limit: pagedLimit(context), cursor: context.req.query('cursor') ?? null }));
  } catch (error) {
    if (error instanceof RunQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/runs/:runId', async (context) => {
  try { return context.json(await getRun({ repository, runId: context.req.param('runId') })); }
  catch (error) { if (error instanceof RunQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
});

app.get('/challenges/:challengeId', async (context) => {
  try {
    const challengeId = context.req.param('challengeId');
    const detail = await getChallenge({ repository, challengeId });
    return context.json({ ...detail, etag: revisionEtagFor(challengeId, detail.currentRevision) });
  } catch (error) { if (error instanceof ChallengeQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
});

app.get('/attempts/:attemptId', async (context) => {
  try { return context.json(await getAttempt({ repository, attemptId: context.req.param('attemptId') })); }
  catch (error) { if (error instanceof AttemptQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
});

app.get('/actors', async (context) => {
  try {
    return context.json(await listActors({ repository, limit: pagedLimit(context) }));
  } catch (error) {
    if (error instanceof ContributionQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/actors/:actorId', async (context) => {
  try { return context.json(await getContribution({ repository, actorId: context.req.param('actorId') })); }
  catch (error) { if (error instanceof ContributionQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
});

app.get('/claims/:claimId/verifications', async (context) => {
  try {
    const items = await listClaimVerifications({ repository, claimId: context.req.param('claimId'), outcome: context.req.query('outcome') ?? null, contextMode: context.req.query('contextMode') ?? null, actorId: context.req.query('actorId') ?? null });
    return context.json({ items });
  } catch (error) {
    if (error instanceof VerificationQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/verifications/:receiptId', async (context) => {
  try { return context.json(await getVerificationReceipt({ repository, receiptId: context.req.param('receiptId') })); }
  catch (error) { if (error instanceof VerificationQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
});

app.get('/events', async (context) => {
  try {
    return context.json(await listResearchEvents({
      repository,
      objectType: context.req.query('objectType') ?? null,
      objectId: context.req.query('objectId') ?? null,
      actorId: context.req.query('actorId') ?? null,
      eventType: context.req.query('eventType') ?? null,
      createdAfter: context.req.query('createdAfter') ?? null,
      createdBefore: context.req.query('createdBefore') ?? null,
      limit: pagedLimit(context),
      cursor: context.req.query('cursor') ?? null,
    }));
  } catch (error) {
    if (error instanceof ResearchEventQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/events/export', async (context) => {
  try {
    const ndjson = await exportResearchEventRangeNdjson({ repository, firstEventId: context.req.query('firstEventId'), lastEventId: context.req.query('lastEventId') });
    return context.body(ndjson, 200, { 'content-type': 'application/x-ndjson' });
  } catch (error) {
    if (error instanceof ResearchEventExportError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/events/:eventId/proof', async (context) => {
  try { return context.json(await getResearchEventInclusionProof({ repository, eventId: context.req.param('eventId') })); }
  catch (error) { if (error instanceof ResearchEventProofError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
});

app.get('/checkpoints/:checkpointId', async (context) => {
  try { return context.json(await getMerkleCheckpoint({ repository, checkpointId: context.req.param('checkpointId') })); }
  catch (error) { if (error instanceof MerkleCheckpointQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
});

app.get('/merge-proposals/:proposalId', async (context) => {
  try { return context.json(await getMergeProposal({ repository, proposalId: context.req.param('proposalId') })); }
  catch (error) { if (error instanceof MergeProposalQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
});

app.get('/provenance/:objectType/:objectId', async (context) => {
  try {
    return context.json(await getObjectProvenance({ repository, objectType: context.req.param('objectType'), objectId: context.req.param('objectId'), objectRevision: Number(context.req.query('revision')) }));
  } catch (error) {
    if (error instanceof ObjectProvenanceQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.get('/projects/:projectId/frontier/diff', async (context) => {
  try {
    return context.json(await diffFrontiers({ repository, projectId: context.req.param('projectId'), fromSnapshotId: context.req.query('fromSnapshotId'), toSnapshotId: context.req.query('toSnapshotId') }));
  } catch (error) {
    if (error instanceof FrontierQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status);
    throw error;
  }
});

app.post('/projects/:projectId/revisions', async (context) => {
  try {
    if (typeof projectEventFactory !== 'function') return context.json(errorBody('PROJECT_REVISION_UNAVAILABLE', 'project revision is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const projectId = context.req.param('projectId');
    const current = await repository?.getCurrentProjectRevision?.(projectId);
    if (!current) return context.json(errorBody('PROJECT_REVISION_NOT_FOUND', 'current project revision not found', context.get('requestId')), 404);
    const body = await context.req.json();
    return context.json(await reviseProject({
      repository,
      actorId,
      projectId,
      ifMatch: context.req.header('if-match') ?? null,
      currentEtag: revisionEtagFor(projectId, current),
      etagForRevision: (revision) => revisionEtagFor(projectId, revision),
      name: body.name,
      summary: body.summary,
      license: body.license,
      maintainerIds: body.maintainerIds,
      eventFactory: projectEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof ProjectCommandError) return response ?? context.json(errorBody(error.code ?? 'project_revision_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/questions/:questionId/transitions', async (context) => {
  try {
    if (typeof questionEventFactory !== 'function' || typeof questionRoleResolver !== 'function') return context.json(errorBody('QUESTION_TRANSITION_UNAVAILABLE', 'question transition is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const questionId = context.req.param('questionId');
    const actorRole = await questionRoleResolver({ repository, actorId, questionId });
    const { toState, automaticPublication = false } = await context.req.json();
    if (automaticPublication && typeof questionRiskResolver !== 'function') {
      return context.json(errorBody('QUESTION_RISK_RESOLVER_UNAVAILABLE', 'question risk resolver is not configured', context.get('requestId')), 503);
    }
    const riskSignals = automaticPublication
      ? await questionRiskResolver({ repository, actorId, questionId, toState, claims })
      : undefined;
    return context.json(await transitionQuestion({ repository, actorId, actorRole, questionId, toState, automaticPublication, riskSignals, eventFactory: questionEventFactory }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof QuestionCommandError) return response ?? context.json(errorBody(error.code ?? 'question_transition_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/tasks', async (context) => {
  try {
    if (typeof taskEventFactory !== 'function' || typeof taskRoleResolver !== 'function') return context.json(errorBody('TASK_CREATION_UNAVAILABLE', 'task creation is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json();
    const actorRole = await taskRoleResolver({ repository, actorId, questionId: body.questionId ?? null, projectId: body.projectId ?? null });
    return context.json(await createTask({
      repository,
      actorId,
      actorRole,
      taskId: body.taskId,
      questionId: body.questionId ?? null,
      title: body.title,
      description: body.description,
      inputs: body.inputs ?? [],
      outputs: body.outputs,
      acceptance: body.acceptance,
      contextMode: body.contextMode,
      eventFactory: taskEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof TaskCommandError) return response ?? context.json(errorBody(error.code ?? 'task_creation_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/claims', async (context) => {
  try {
    if (typeof claimEventFactory !== 'function' || typeof claimRoleResolver !== 'function') return context.json(errorBody('CLAIM_CREATION_UNAVAILABLE', 'claim creation is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json();
    const submission = {
      claimId: body.claimId,
      questionId: body.questionId ?? null,
      statement: body.statement,
      scope: body.scope,
      assumptions: body.assumptions ?? [],
      falsification: body.falsification,
    };
    if (body.signatureEnvelope !== undefined) {
      // Verify against the exact sent payload (minus the envelope itself);
      // defaults are applied only when constructing the domain command.
      const signedPayload = { ...body };
      delete signedPayload.signatureEnvelope;
      await verifyClientSignatureEnvelope({ repository, signatureNonceStore: nonceStoreFor(context), actorId, envelope: body.signatureEnvelope, payload: signedPayload, expectedEventType: 'claim.created' });
    }
    const actorRole = await claimRoleResolver({ repository, actorId, questionId: body.questionId ?? null, projectId: body.projectId ?? null });
    return context.json(await createClaim({
      repository,
      actorId,
      actorRole,
      ...submission,
      eventFactory: claimEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof ClaimCommandError) return response ?? context.json(errorBody(error.code ?? 'claim_creation_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/claims/:claimId/revisions', async (context) => {
  try {
    if (typeof claimEventFactory !== 'function' || typeof claimRoleResolver !== 'function') return context.json(errorBody('CLAIM_REVISION_UNAVAILABLE', 'claim revision is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const claimId = context.req.param('claimId');
    const current = await repository?.getCurrentClaimRevision?.(claimId);
    if (!current) return context.json(errorBody('CLAIM_REVISION_NOT_FOUND', 'current claim revision not found', context.get('requestId')), 404);
    const actorRole = await claimRoleResolver({ repository, actorId, claimId });
    const body = await context.req.json();
    return context.json(await reviseClaim({
      repository,
      actorId,
      actorRole,
      claimId,
      ifMatch: context.req.header('if-match') ?? null,
      currentEtag: revisionEtagFor(claimId, current),
      etagForRevision: (revision) => revisionEtagFor(claimId, revision),
      questionId: body.questionId,
      statement: body.statement,
      scope: body.scope,
      assumptions: body.assumptions,
      falsification: body.falsification,
      eventFactory: claimEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof ClaimCommandError) return response ?? context.json(errorBody(error.code ?? 'claim_revision_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/claims/:claimId/transitions', async (context) => {
  try {
    if (typeof claimEventFactory !== 'function' || typeof claimRoleResolver !== 'function') return context.json(errorBody('CLAIM_TRANSITION_UNAVAILABLE', 'claim transition is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const claimId = context.req.param('claimId');
    const current = await repository?.getCurrentClaimRevision?.(claimId);
    if (!current) return context.json(errorBody('CLAIM_REVISION_NOT_FOUND', 'current claim revision not found', context.get('requestId')), 404);
    const actorRole = await claimRoleResolver({ repository, actorId, claimId });
    const { toState } = await context.req.json();
    return context.json(await transitionClaim({
      repository,
      actorId,
      actorRole,
      claimId,
      toState,
      ifMatch: context.req.header('if-match') ?? null,
      currentEtag: revisionEtagFor(claimId, current),
      etagForRevision: (revision) => revisionEtagFor(claimId, revision),
      eventFactory: claimEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof ClaimCommandError) return response ?? context.json(errorBody(error.code ?? 'claim_transition_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/attempts/:attemptId/transitions', async (context) => {
  try {
    if (typeof attemptEventFactory !== 'function' || typeof attemptRoleResolver !== 'function') return context.json(errorBody('ATTEMPT_TRANSITION_UNAVAILABLE', 'attempt transition is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const attemptId = context.req.param('attemptId');
    const actorRole = await attemptRoleResolver({ repository, actorId, attemptId });
    const { toState } = await context.req.json();
    return context.json(await transitionAttempt({ repository, actorId, actorRole, attemptId, toState, eventFactory: attemptEventFactory }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof TaskCommandError) return response ?? context.json(errorBody(error.code ?? 'attempt_transition_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/attempts/:attemptId/trace', async (context) => {
  try {
    if (typeof attemptEventFactory !== 'function' || typeof attemptRoleResolver !== 'function') return context.json(errorBody('ATTEMPT_TRACE_UNAVAILABLE', 'attempt trace is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const attemptId = context.req.param('attemptId');
    const actorRole = await attemptRoleResolver({ repository, actorId, attemptId });
    const body = await context.req.json();
    return context.json(await createTraceEvent({
      repository,
      actorId,
      actorRole,
      eventId: body.eventId,
      attemptId,
      eventType: body.eventType,
      payload: body.payload,
      hash: body.hash,
      signature: body.signature,
      parents: body.parents ?? [],
      eventFactory: attemptEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof TaskCommandError) return response ?? context.json(errorBody(error.code ?? 'attempt_trace_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/evidence', async (context) => {
  try {
    if (typeof evidenceEventFactory !== 'function' || typeof evidenceRoleResolver !== 'function') return context.json(errorBody('EVIDENCE_CREATION_UNAVAILABLE', 'evidence creation is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json();
    const actorRole = await evidenceRoleResolver({ repository, actorId, artifactId: body.artifactId ?? null });
    return context.json(await createEvidence({
      repository,
      actorId,
      actorRole,
      evidenceId: body.evidenceId,
      evidenceType: body.evidenceType,
      artifactId: body.artifactId,
      artifactRevision: body.artifactRevision,
      runId: body.runId ?? null,
      links: body.links ?? [],
      eventFactory: evidenceEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof EvidenceCommandError) return response ?? context.json(errorBody(error.code ?? 'evidence_creation_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/evidence/:evidenceId/links', async (context) => {
  try {
    if (typeof evidenceEventFactory !== 'function' || typeof evidenceRoleResolver !== 'function') return context.json(errorBody('EVIDENCE_LINK_UNAVAILABLE', 'evidence linking is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const evidenceId = context.req.param('evidenceId');
    const actorRole = await evidenceRoleResolver({ repository, actorId, evidenceId });
    const body = await context.req.json();
    return context.json(await linkEvidenceClaim({
      repository,
      actorId,
      actorRole,
      evidenceId,
      claimId: body.claimId,
      claimRevision: body.claimRevision,
      relationType: body.relationType,
      eventFactory: evidenceEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof EvidenceCommandError) return response ?? context.json(errorBody(error.code ?? 'evidence_link_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/runs', async (context) => {
  try {
    if (typeof runEventFactory !== 'function' || typeof runRoleResolver !== 'function') return context.json(errorBody('RUN_CREATION_UNAVAILABLE', 'run creation is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json();
    const submission = {
      runId: body.runId,
      taskId: body.taskId,
      contextBundleId: body.contextBundleId,
      sourceCode: body.sourceCode,
      container: body.container,
      command: body.command,
      args: body.args ?? [],
      environment: body.environment,
      hardware: body.hardware,
      randomSeed: body.randomSeed,
      startedAt: body.startedAt,
      endedAt: body.endedAt,
      networkAccess: body.networkAccess ?? false,
      exitCode: body.exitCode,
      signature: body.signature,
      inputs: body.inputs ?? [],
      outputs: body.outputs ?? [],
    };
    if (body.signatureEnvelope !== undefined) {
      const signedPayload = { ...body };
      delete signedPayload.signatureEnvelope;
      await verifyClientSignatureEnvelope({ repository, signatureNonceStore: nonceStoreFor(context), actorId, envelope: body.signatureEnvelope, payload: signedPayload, expectedEventType: 'run.created' });
    }
    const actorRole = await runRoleResolver({ repository, actorId, taskId: body.taskId ?? null });
    return context.json(await createRun({
      repository,
      actorId,
      actorRole,
      ...submission,
      startedAt: submission.startedAt === undefined ? undefined : new Date(submission.startedAt),
      endedAt: submission.endedAt === undefined ? undefined : new Date(submission.endedAt),
      eventFactory: runEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof RunCommandError) return response ?? context.json(errorBody(error.code ?? 'run_creation_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/artifacts/upload-plan', async (context) => {
  try {
    if (typeof uploadSigner !== 'function') return context.json(errorBody('UPLOAD_UNAVAILABLE', 'artifact upload is not configured', context.get('requestId')), 503);
    const body = await context.req.json();
    const plan = await createSingleUploadPlan({
      artifactId: body.artifactId,
      revision: Number(body.revision),
      rawHash: body.rawHash,
      sizeBytes: body.sizeBytes,
      mediaType: body.mediaType,
      fileName: body.fileName,
      signer: uploadSigner,
    });
    return context.json(plan, 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof UploadSessionError) return response ?? context.json(errorBody(error.code ?? 'upload_plan_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/artifacts', async (context) => {
  try {
    if (typeof artifactEventFactory !== 'function' || typeof artifactRoleResolver !== 'function') return context.json(errorBody('ARTIFACT_CREATION_UNAVAILABLE', 'artifact creation is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json();
    const actorRole = await artifactRoleResolver({ repository, actorId });
    return context.json(await createArtifact({
      repository,
      actorId,
      actorRole,
      artifactId: body.artifactId,
      artifactType: body.artifactType,
      rawHash: body.rawHash,
      semanticHash: body.semanticHash ?? null,
      sizeBytes: body.sizeBytes,
      mediaType: body.mediaType,
      license: body.license,
      description: body.description ?? null,
      locationId: body.locationId,
      location: body.location,
      eventFactory: artifactEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof ArtifactCommandError) return response ?? context.json(errorBody(error.code ?? 'artifact_creation_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/verifications/prepare', async (context) => {
  try {
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json();
    return context.json(await prepareVerification({
      repository,
      actorId,
      claimId: body.claimId,
      claimRevision: body.claimRevision,
      contractId: body.contractId,
      contractRevision: body.contractRevision,
      nonce: body.nonce,
    }));
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof VerificationPrepareError) return response ?? context.json(errorBody(error.code ?? 'verification_prepare_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/verifications', async (context) => {
  try {
    if (typeof verificationEventFactory !== 'function' || typeof verificationRoleResolver !== 'function') return context.json(errorBody('VERIFICATION_SUBMIT_UNAVAILABLE', 'verification submission is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json();
    const submission = {
      receiptId: body.receiptId,
      runId: body.runId,
      claimId: body.claimId,
      claimRevision: body.claimRevision,
      contractId: body.contractId,
      contractRevision: body.contractRevision,
      outcome: body.outcome,
      verificationTypes: body.verificationTypes,
      contextMode: body.contextMode,
      sawExpectedOutputs: body.sawExpectedOutputs,
      implementationRelation: body.implementationRelation,
      dataRelation: body.dataRelation,
      modelFamily: body.modelFamily,
      findings: (body.findings ?? []).map((finding, index) => ({ findingId: finding.findingId ?? `${body.receiptId}_finding_${index + 1}`, ...finding })),
      contributionStatementId: body.contributionStatementId,
    };
    if (body.signatureEnvelope !== undefined) {
      const signedPayload = { ...body };
      delete signedPayload.signatureEnvelope;
      await verifyClientSignatureEnvelope({ repository, signatureNonceStore: nonceStoreFor(context), actorId, envelope: body.signatureEnvelope, payload: signedPayload, expectedEventType: 'verification.submitted' });
    }
    const actorRole = await verificationRoleResolver({ repository, actorId, claimId: body.claimId ?? null });
    return context.json(await submitVerification({
      repository,
      actorId,
      actorRole,
      ...submission,
      eventFactory: verificationEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof VerificationSubmitError) return response ?? context.json(errorBody(error.code ?? 'verification_submit_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/challenges', async (context) => {
  try {
    if (typeof challengeEventFactory !== 'function' || typeof challengeRoleResolver !== 'function') return context.json(errorBody('CHALLENGE_CREATION_UNAVAILABLE', 'challenge creation is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const body = await context.req.json();
    const submission = {
      challengeId: body.challengeId,
      targetClaimId: body.targetClaimId,
      targetClaimRevision: body.targetClaimRevision,
      reason: body.reason,
      impact: body.impact,
      proposedResolution: body.proposedResolution ?? null,
    };
    if (body.signatureEnvelope !== undefined) {
      const signedPayload = { ...body };
      delete signedPayload.signatureEnvelope;
      await verifyClientSignatureEnvelope({ repository, signatureNonceStore: nonceStoreFor(context), actorId, envelope: body.signatureEnvelope, payload: signedPayload, expectedEventType: 'challenge.created' });
    }
    const actorRole = await challengeRoleResolver({ repository, actorId, targetClaimId: body.targetClaimId ?? null });
    return context.json(await createChallenge({
      repository,
      actorId,
      actorRole,
      ...submission,
      eventFactory: challengeEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof ChallengeCommandError) return response ?? context.json(errorBody(error.code ?? 'challenge_creation_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.post('/challenges/:challengeId/transitions', async (context) => {
  try {
    if (typeof challengeEventFactory !== 'function' || typeof challengeRoleResolver !== 'function') return context.json(errorBody('CHALLENGE_TRANSITION_UNAVAILABLE', 'challenge transition is not configured', context.get('requestId')), 503);
    const claims = await authenticateRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const challengeId = context.req.param('challengeId');
    const current = await repository?.getCurrentChallengeRevision?.(challengeId);
    if (!current) return context.json(errorBody('CHALLENGE_REVISION_NOT_FOUND', 'current challenge revision not found', context.get('requestId')), 404);
    const actorRole = await challengeRoleResolver({ repository, actorId, challengeId });
    const { toState } = await context.req.json();
    return context.json(await transitionChallenge({
      repository,
      actorId,
      actorRole,
      challengeId,
      toState,
      ifMatch: context.req.header('if-match') ?? null,
      currentEtag: revisionEtagFor(challengeId, current),
      etagForRevision: (revision) => revisionEtagFor(challengeId, revision),
      eventFactory: challengeEventFactory,
    }), 201);
  } catch (error) {
    const response = knownFailure(error, context);
    if (response || error instanceof ChallengeCommandError) return response ?? context.json(errorBody(error.code ?? 'challenge_transition_failed', error.message, context.get('requestId')), error.status ?? 400);
    throw error;
  }
});

app.notFound((context) => context.json(errorBody("not_found", "route not found", context.get("requestId")), 404));

app.onError((error, context) => {
  if (error instanceof RequestValidationError) {
    return context.json({
      ...errorBody(error.code, error.message, context.get("requestId")),
      issues: error.issues,
    }, 400);
  }
  /* Typed failures (query and repository errors carry code + status) keep
   * their semantics instead of collapsing into an opaque 500. */
  if (error instanceof Error && typeof error.status === "number" && typeof error.code === "string") {
    return context.json(errorBody(error.code, error.message, context.get("requestId")), error.status);
  }
  console.error("api request failed", error);
  return context.json(errorBody("internal_error", "internal server error", context.get("requestId")), 500);
});

return app;
}

export function createWorker({ fetchImpl = fetch } = {}) {
  const unconfiguredApp = createApp();
  const hostedApps = new Map();
  return Object.freeze({
    fetch(request, env = {}, executionContext) {
      const publishableKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
      if (!env.SUPABASE_URL || !publishableKey) {
        return unconfiguredApp.fetch(request, env, executionContext);
      }
      const key = `${env.SUPABASE_URL}\u0000${publishableKey}`;
      if (!hostedApps.has(key)) hostedApps.set(key, createApp({
        repository: createSupabaseReadRepository({ url: env.SUPABASE_URL, publishableKey, fetchImpl }),
      }));
      return hostedApps.get(key).fetch(request, env, executionContext);
    },
    request: unconfiguredApp.request.bind(unconfiguredApp),
  });
}

export default createWorker();
