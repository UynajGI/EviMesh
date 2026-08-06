import { Hono } from "hono";
import { authenticateSupabaseRequest, JwtVerificationError } from "./jwt.mjs";
import { ContextQueryError, getTaskContext } from "./context-query.mjs";
import { RequestValidationError } from "./validation.mjs";
import { getPlatformPublicKeys, PlatformPublicKeysError } from './platform-public-keys.mjs';
import { getOwnProfile, patchOwnProfile } from './profile-api.mjs';
import { ActorIdentityError, resolveActorForSupabaseClaims } from './actor-identity.mjs';
import { ActorProfileError } from '../../../packages/domain/src/actor-profile.mjs';
import { ProjectAuthorizationError } from '../../../packages/domain/src/project-authorization.mjs';
import { registerOwnSigningKey } from './signing-key-api.mjs';
import { SigningKeyError } from '../../../packages/domain/src/signing-key.mjs';
import { listOwnTokens, createOwnToken, revokeOwnToken } from './api-token-api.mjs';
import { ApiTokenError } from '../../../packages/domain/src/api-token.mjs';
import { getQuestion, listQuestions, QuestionQueryError } from './question-query.mjs';
import { getClaim, getClaimDownstreamGraph, getClaimUpstreamGraph, listClaims, ClaimQueryError } from './claim-query.mjs';
import { getProject, listProjects, ProjectQueryError } from './project-query.mjs';
import { getLatestFrontier, listFrontierHistory, FrontierQueryError } from './frontier-query.mjs';
import { getTask, listTasks, TaskQueryError } from './task-query.mjs';
import { createProject } from '../../../packages/domain/src/project-command.mjs';
import { ProjectCommandError } from '../../../packages/domain/src/project-command.mjs';
import { createQuestion } from '../../../packages/domain/src/question-command.mjs';
import { QuestionCommandError } from '../../../packages/domain/src/question-command.mjs';
import { acquireTaskLease, createAttempt, releaseTaskLease, TaskCommandError } from '../../../packages/domain/src/task-command.mjs';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function requestIdFor(value) {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value) ? value : crypto.randomUUID();
}

function errorBody(code, message, requestId) {
  return { code, message, request_id: requestId };
}

export function createApp({ repository = null, projectEventFactory = null, questionEventFactory = null, questionRoleResolver = null, attemptEventFactory = null, attemptRoleResolver = null, leaseEventFactory = null, leaseRoleResolver = null, authenticate = authenticateSupabaseRequest } = {}) {
const app = new Hono();

app.use("*", async (context, next) => {
  const requestId = requestIdFor(context.req.header("x-request-id"));
  context.set("requestId", requestId);
  context.header("x-request-id", requestId);
  await next();
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
    const claims = await authenticate(context.req.raw, context.env);
    return context.json({ subject: claims.sub, email: claims.email ?? null });
  } catch (error) {
    if (error instanceof JwtVerificationError || error instanceof SyntaxError) {
      return context.json(errorBody("unauthorized", "authentication required", context.get("requestId")), 401);
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
    return context.json(await getClaim({ repository, claimId: context.req.param('claimId') }));
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
  try { return context.json(await getProject({ repository, projectId: context.req.param('projectId') })); }
  catch (error) { if (error instanceof ProjectQueryError) return context.json(errorBody(error.code, error.message, context.get('requestId')), error.status); throw error; }
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
    const claims = await authenticate(context.req.raw, context.env);
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
    const claims = await authenticate(context.req.raw, context.env);
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
    return context.json(await getTask({ repository, taskId: context.req.param('taskId') }));
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
    const claims = await authenticate(context.req.raw, context.env);
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
    const claims = await authenticate(context.req.raw, context.env);
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
    const claims = await authenticate(context.req.raw, context.env);
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
    const claims = await authenticateSupabaseRequest(context.req.raw, context.env);
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
    const claims = await authenticateSupabaseRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const patch = await context.req.json();
    return context.json(await patchOwnProfile({ repository, actorId, patch }));
  } catch (error) {
    const status = error instanceof JwtVerificationError ? 401 : error instanceof ActorIdentityError ? error.status : error instanceof ActorProfileError ? 400 : error.status;
    if (status) return context.json(errorBody(error.code ?? 'profile_unavailable', error.message, context.get('requestId')), status);
    throw error;
  }
});

app.post('/signing-keys', async (context) => {
  try {
    const claims = await authenticateSupabaseRequest(context.req.raw, context.env);
    const actorId = await resolveActorForSupabaseClaims({ repository, claims });
    const { keyId, publicKey } = await context.req.json();
    return context.json(await registerOwnSigningKey({ repository, actorId, keyId, publicKey }), 201);
  } catch (error) {
    const status = error instanceof JwtVerificationError ? 401 : error instanceof ActorIdentityError ? error.status : error instanceof SigningKeyError ? 400 : error.status;
    if (status) return context.json(errorBody(error.code ?? 'signing_key_unavailable', error.message, context.get('requestId')), status);
    throw error;
  }
});

async function actorFor(context) { return resolveActorForSupabaseClaims({ repository, claims: await authenticateSupabaseRequest(context.req.raw, context.env) }); }
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

app.notFound((context) => context.json(errorBody("not_found", "route not found", context.get("requestId")), 404));

app.onError((error, context) => {
  if (error instanceof RequestValidationError) {
    return context.json({
      ...errorBody(error.code, error.message, context.get("requestId")),
      issues: error.issues,
    }, 400);
  }
  console.error("api request failed", error);
  return context.json(errorBody("internal_error", "internal server error", context.get("requestId")), 500);
});

return app;
}

export default createApp();
