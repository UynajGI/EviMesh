import {
  changeProjectMembershipRole,
  createProjectInvitation,
  decideProjectApplication,
  ProjectAdmissionError,
  removeProjectMembership,
  respondToProjectInvitation,
  revokeProjectInvitation,
  submitProjectApplication,
  withdrawProjectApplication,
} from '../../../packages/domain/src/project-admission.mjs';
import { completePublicOnboarding, PublicOnboardingError } from '../../../packages/domain/src/public-onboarding.mjs';
import { listActorSigningKeys, revokeActorSigningKey, SigningKeyError } from '../../../packages/domain/src/signing-key.mjs';
import { registerOwnSigningKey } from './signing-key-api.mjs';

const RPC_NAMES = Object.freeze({
  completeOnboarding: 'actor_onboarding_complete',
  listSigningKeys: 'signing_key_list',
  registerSigningKey: 'signing_key_register',
  revokeSigningKey: 'signing_key_revoke',
  submitProjectApplication: 'project_application_submit',
  withdrawProjectApplication: 'project_application_withdraw',
  decideProjectApplication: 'project_application_decide_atomic',
  listProjectApplications: 'project_application_list',
  getProjectApplication: 'project_application_get',
  createProjectInvitation: 'project_invitation_create',
  respondToProjectInvitation: 'project_invitation_respond',
  revokeProjectInvitation: 'project_invitation_revoke',
  changeProjectMembershipRole: 'project_membership_change_role',
  removeProjectMembership: 'project_membership_remove',
  createManagedAgent: 'managed_agent_create',
  retireManagedAgent: 'managed_agent_retire',
  enrollProjectAgent: 'project_agent_enroll',
  removeProjectAgent: 'project_agent_remove',
  listProjectMembers: 'project_member_list',
  listProjectInvitations: 'project_invitation_list',
});

/** The platform governance service actor seeded by migration 0090. */
export const PLATFORM_GOVERNANCE_ACTOR_ID = 'actor_platform_evimesh';

const SQLSTATE_STATUS = Object.freeze({
  '22023': 400,
  '23505': 409,
  '42501': 403,
  '55000': 409,
  P0002: 404,
});

export class PublicAdmissionApiError extends Error {
  constructor(message, code = 'PUBLIC_ADMISSION_UNAVAILABLE', status = 503) {
    super(message);
    this.name = 'PublicAdmissionApiError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PublicAdmissionApiError(`${field} is required`, 'PUBLIC_ADMISSION_INVALID', 400);
  }
  return value.trim();
}

function encodedEq(value) {
  return `eq.${requiredText(value, 'query value')}`;
}

function serviceHeaders(serviceRoleKey, extra = {}) {
  const headers = {
    accept: 'application/json',
    apikey: serviceRoleKey,
    ...extra,
  };
  // Current sb_secret_* credentials are opaque gateway API keys, not JWTs.
  // Legacy service_role JWTs still need Authorization for older/local stacks.
  if (!serviceRoleKey.startsWith('sb_secret_')) headers.authorization = `Bearer ${serviceRoleKey}`;
  return headers;
}

function postgresFailure(payload) {
  const rawMessage = typeof payload?.message === 'string' ? payload.message : '';
  const tagged = /^\[([A-Z0-9_]+)\]\s*(.*)$/.exec(rawMessage);
  const code = tagged?.[1] ?? 'PUBLIC_ADMISSION_REPOSITORY_FAILED';
  const message = tagged?.[2] || 'public admission operation failed';
  // Only allowlisted database guards become caller-facing 4xx errors. Missing
  // migrations, gateway/auth failures, and unknown PostgREST errors stay 503.
  const status = SQLSTATE_STATUS[payload?.code] ?? 503;
  return new PublicAdmissionApiError(message, code, status);
}

/**
 * Service-only PostgREST adapter for the fixed admission RPC allowlist.
 * It never accepts an arbitrary function/table name and never returns secret
 * request headers to callers or logs.
 */
export function createSupabasePublicAdmissionRepository({
  url,
  publishableKey = null,
  serviceRoleKey,
  fetchImpl = fetch,
  platformEventFactory = null,
  platformActorId = PLATFORM_GOVERNANCE_ACTOR_ID,
} = {}) {
  const baseUrl = requiredText(url, 'Supabase URL').replace(/\/$/, '');
  const secret = requiredText(serviceRoleKey, 'Supabase service-role key');
  if (typeof fetchImpl !== 'function') throw new PublicAdmissionApiError('fetch implementation is required');
  // Approval creates a Project node in the signed graph, so it is ready only
  // when the platform governance signer is configured.
  const projectApprovalGraphWriteReady = typeof platformEventFactory === 'function';

  async function readPayload(response) {
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw postgresFailure(payload);
    return payload;
  }

  async function rpc(name, body) {
    if (!Object.values(RPC_NAMES).includes(name)) {
      throw new PublicAdmissionApiError('public admission RPC is not allowlisted', 'PUBLIC_ADMISSION_RPC_FORBIDDEN', 500);
    }
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: serviceHeaders(secret, { 'content-type': 'application/json' }),
        body: JSON.stringify(body),
      });
    } catch {
      throw new PublicAdmissionApiError('public admission repository is unavailable');
    }
    return readPayload(response);
  }

  async function getProjectRole({ projectId, actorId } = {}) {
    const params = new URLSearchParams({
      select: 'role',
      project_id: encodedEq(projectId),
      actor_id: encodedEq(actorId),
      status: 'eq.active',
      deleted_at: 'is.null',
      limit: '1',
    });
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/rest/v1/project_members?${params}`, {
        headers: serviceHeaders(secret),
      });
    } catch {
      throw new PublicAdmissionApiError('project membership lookup is unavailable');
    }
    const rows = await readPayload(response);
    return Array.isArray(rows) && typeof rows[0]?.role === 'string' ? rows[0].role : null;
  }

  async function getAuthenticatedUser({ accessToken } = {}) {
    const token = requiredText(accessToken, 'Supabase access token');
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/auth/v1/user`, {
        headers: {
          accept: 'application/json',
          apikey: publishableKey || secret,
          authorization: `Bearer ${token}`,
        },
      });
    } catch {
      throw new PublicAdmissionApiError('authenticated user verification is unavailable');
    }
    if (!response.ok) {
      throw new PublicAdmissionApiError('authenticated user verification failed', 'ONBOARDING_AUTH_UNAVAILABLE', 503);
    }
    return response.json().catch(() => {
      throw new PublicAdmissionApiError('authenticated user verification returned an invalid response', 'ONBOARDING_AUTH_UNAVAILABLE', 503);
    });
  }

  return Object.freeze({
    projectApprovalGraphWriteReady: projectApprovalGraphWriteReady === true,
    getAuthenticatedUser,
    getProjectRole,
    completeOnboarding: (input) => rpc(RPC_NAMES.completeOnboarding, {
      p_actor_id: input.actorId,
      p_auth_subject: input.authSubject,
      p_terms_version: input.termsVersion,
      p_accepted_at: input.acceptedAt,
      p_display_name: input.displayName,
      p_bio: input.bio ?? null,
      p_avatar_url: input.avatarUrl ?? null,
    }),
    listSigningKeys: (actorId) => rpc(RPC_NAMES.listSigningKeys, { p_actor_id: actorId }),
    registerSigningKey: (input) => rpc(RPC_NAMES.registerSigningKey, {
      p_actor_id: input.actorId,
      p_key_id: input.keyId,
      p_public_key: input.publicKey,
      p_label: input.label ?? 'Signing key',
      p_created_at: input.createdAt ?? new Date().toISOString(),
    }),
    revokeSigningKey: (input) => rpc(RPC_NAMES.revokeSigningKey, {
      p_actor_id: input.actorId,
      p_key_id: input.keyId,
      p_reason: input.reason,
      p_revoked_at: input.revokedAt ?? new Date().toISOString(),
    }),
    submitProjectApplication: (input) => rpc(RPC_NAMES.submitProjectApplication, {
      p_applicant_actor_id: input.applicantActorId,
      p_proposed_project_id: input.proposedProjectId,
      p_name: input.name,
      p_summary: input.summary,
      p_license: input.license,
      p_submitted_at: input.submittedAt,
    }),
    withdrawProjectApplication: (input) => rpc(RPC_NAMES.withdrawProjectApplication, {
      p_application_id: input.applicationId,
      p_applicant_actor_id: input.applicantActorId,
      p_withdrawn_at: input.withdrawnAt,
    }),
    decideProjectApplication: async (input) => {
      if (typeof platformEventFactory !== 'function') {
        throw new PublicAdmissionApiError('project decisions require the platform governance signer', 'PROJECT_APPROVAL_GRAPH_WRITE_NOT_READY', 503);
      }
      const application = await rpc(RPC_NAMES.getProjectApplication, { p_application_id: input.applicationId });
      if (!application || typeof application !== 'object') {
        throw new PublicAdmissionApiError('application was not found', 'PROJECT_APPLICATION_NOT_FOUND', 404);
      }
      // The platform signs a governance event that binds the exact application
      // content and steward decision; it never claims a Human signature.
      const platformEvent = await platformEventFactory({
        eventType: 'governance.project_application_decided',
        payload: {
          schema: 'evimesh.project-application-decision.v1',
          actor_id: platformActorId,
          signer_semantics: 'platform_governance',
          human_signature: false,
          application_id: input.applicationId,
          steward_actor_id: input.stewardActorId,
          applicant_actor_id: application.applicantActorId,
          decision: input.decision,
          reason: input.reason,
          project_id: application.proposedProjectId,
          project_revision: input.decision === 'approved' ? 1 : null,
          project_name: application.name,
          project_summary: application.summary,
          project_license: application.license,
          decided_at: input.decidedAt,
        },
      });
      return rpc(RPC_NAMES.decideProjectApplication, {
        p_application_id: input.applicationId,
        p_steward_actor_id: input.stewardActorId,
        p_decision: input.decision,
        p_reason: input.reason,
        p_decided_at: input.decidedAt,
        p_platform_actor_id: platformActorId,
        p_platform_event: platformEvent,
      });
    },
    listProjectApplications: ({ viewerActorId, scope }) => rpc(RPC_NAMES.listProjectApplications, {
      p_viewer_actor_id: viewerActorId,
      p_scope: scope,
    }),
    listProjectMembers: ({ projectId }) => rpc(RPC_NAMES.listProjectMembers, { p_project_id: projectId }),
    listProjectInvitations: ({ viewerActorId, projectId = null }) => rpc(RPC_NAMES.listProjectInvitations, {
      p_viewer_actor_id: viewerActorId,
      p_project_id: projectId,
    }),
    createManagedAgent: (input) => rpc(RPC_NAMES.createManagedAgent, {
      p_owner_actor_id: input.ownerActorId,
      p_display_name: input.displayName,
      p_model_name: input.modelName ?? null,
      p_runtime: input.runtime ?? null,
    }),
    retireManagedAgent: (input) => rpc(RPC_NAMES.retireManagedAgent, {
      p_owner_actor_id: input.ownerActorId,
      p_agent_actor_id: input.agentActorId,
      p_reason: input.reason,
    }),
    enrollProjectAgent: (input) => rpc(RPC_NAMES.enrollProjectAgent, {
      p_project_id: input.projectId,
      p_agent_actor_id: input.agentActorId,
      p_enrolled_by_actor_id: input.enrolledByActorId,
    }),
    removeProjectAgent: (input) => rpc(RPC_NAMES.removeProjectAgent, {
      p_project_id: input.projectId,
      p_agent_actor_id: input.agentActorId,
      p_removed_by_actor_id: input.removedByActorId,
    }),
    createProjectInvitation: (input) => rpc(RPC_NAMES.createProjectInvitation, {
      p_project_id: input.projectId,
      p_invited_actor_id: input.invitedActorId,
      p_invited_by_actor_id: input.invitedByActorId,
      p_role: input.role,
      p_created_at: input.createdAt,
      p_expires_at: input.expiresAt,
    }),
    respondToProjectInvitation: (input) => rpc(RPC_NAMES.respondToProjectInvitation, {
      p_invitation_id: input.invitationId,
      p_invited_actor_id: input.invitedActorId,
      p_response: input.response,
      p_responded_at: input.respondedAt,
    }),
    revokeProjectInvitation: (input) => rpc(RPC_NAMES.revokeProjectInvitation, {
      p_invitation_id: input.invitationId,
      p_revoked_by_actor_id: input.revokedByActorId,
      p_reason: input.reason,
      p_revoked_at: input.revokedAt,
    }),
    changeProjectMembershipRole: (input) => rpc(RPC_NAMES.changeProjectMembershipRole, {
      p_project_id: input.projectId,
      p_target_actor_id: input.targetActorId,
      p_changed_by_actor_id: input.changedByActorId,
      p_role: input.role,
      p_reason: input.reason,
      p_changed_at: input.changedAt,
    }),
    removeProjectMembership: (input) => rpc(RPC_NAMES.removeProjectMembership, {
      p_project_id: input.projectId,
      p_target_actor_id: input.targetActorId,
      p_removed_by_actor_id: input.removedByActorId,
      p_reason: input.reason,
      p_removed_at: input.removedAt,
    }),
  });
}

function signingRepository(repository, label = 'Signing key') {
  if (typeof repository?.withTransaction === 'function'
      && typeof repository?.findActiveSigningKey === 'function'
      && typeof repository?.insertSigningKey === 'function') return repository;
  const transaction = {
    listSigningKeys: (actorId) => repository.listSigningKeys(actorId),
    findActiveSigningKey: async (actorId) => {
      const keys = await repository.listSigningKeys(actorId);
      return Array.isArray(keys) ? keys.find((key) => !key.revokedAt) ?? null : null;
    },
    insertSigningKey: (key) => repository.registerSigningKey({ ...key, label }),
    revokeSigningKey: (actorId, keyId, reason) => repository.revokeSigningKey({ actorId, keyId, reason }),
  };
  return Object.freeze({
    ...transaction,
    withTransaction: async (callback) => callback(transaction),
  });
}

function admissionErrorStatus(error) {
  if (error instanceof SyntaxError) return 400;
  if (error instanceof SigningKeyError) {
    if (error.code === 'SIGNING_KEY_ALREADY_ACTIVE') return 409;
    if (error.code === 'SIGNING_KEY_NOT_FOUND') return 404;
    return 400;
  }
  if (error instanceof PublicOnboardingError
      || error instanceof ProjectAdmissionError
      || error instanceof PublicAdmissionApiError) return error.status;
  if (error instanceof Error && Number.isInteger(error.status) && typeof error.code === 'string') return error.status;
  return null;
}

function admissionFailure(error, context) {
  const status = admissionErrorStatus(error);
  if (status === null) return null;
  return context.json({
    code: error instanceof SyntaxError ? 'invalid_json' : error.code ?? 'PUBLIC_ADMISSION_INVALID',
    message: error instanceof SyntaxError ? 'request body must be valid JSON' : error.message,
    request_id: context.get?.('requestId') ?? null,
  }, status);
}

function assertAdmissionRepository(repository) {
  if (!repository || typeof repository !== 'object') {
    throw new PublicAdmissionApiError('public admission repository is unavailable');
  }
  return repository;
}

function requiredRepositoryMethod(repository, name) {
  if (typeof repository?.[name] !== 'function') {
    throw new PublicAdmissionApiError(`${name} is unavailable`);
  }
}

async function requestBody(context) {
  return context.req.json();
}

/** Register account/project-governance writes without adding research writes. */
export function registerPublicAdmissionApi(app, {
  admissionRepository,
  authenticateHuman,
  now = () => new Date(),
} = {}) {
  if (!app || typeof app.post !== 'function') throw new TypeError('Hono app is required');
  if (typeof authenticateHuman !== 'function') throw new TypeError('authenticateHuman is required');
  const repository = admissionRepository;

  const route = (handler, successStatus = 200) => async (context) => {
    try {
      assertAdmissionRepository(repository);
      const result = await handler(context);
      return context.json(result, successStatus);
    } catch (error) {
      const response = admissionFailure(error, context);
      if (response) return response;
      throw error;
    }
  };

  app.post('/onboarding/complete', route(async (context) => {
    const authentication = await authenticateHuman(context);
    const body = await requestBody(context);
    if (typeof repository.getAuthenticatedUser !== 'function') {
      throw new PublicAdmissionApiError('authenticated email verification is unavailable', 'ONBOARDING_AUTH_UNAVAILABLE');
    }
    const user = await repository.getAuthenticatedUser({ accessToken: authentication.accessToken });
    const sameSubject = typeof user?.id === 'string' && user.id === authentication.claims?.sub;
    const emailVerified = sameSubject && typeof user?.email_confirmed_at === 'string' && user.email_confirmed_at.length > 0;
    return completePublicOnboarding({
      repository,
      actorId: authentication.actorId,
      authSubject: authentication.claims?.sub,
      emailVerified,
      termsVersion: body.termsVersion,
      acceptedAt: now(),
      displayName: body.displayName,
      bio: body.bio ?? null,
      avatarUrl: body.avatarUrl ?? null,
    });
  }));

  app.get('/signing-keys', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    return { items: await listActorSigningKeys({ repository: signingRepository(repository), actorId }) };
  }));

  app.post('/signing-keys', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    const body = await requestBody(context);
    return registerOwnSigningKey({
      repository: signingRepository(repository, body.label),
      actorId,
      keyId: body.keyId,
      publicKey: body.publicKey,
    });
  }, 201));

  app.delete('/signing-keys/:keyId', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    const body = await requestBody(context);
    return revokeActorSigningKey({
      repository: signingRepository(repository),
      actorId,
      keyId: context.req.param('keyId'),
      reason: body.reason,
    });
  }));

  app.post('/project-applications', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    const body = await requestBody(context);
    return submitProjectApplication({
      repository,
      applicantActorId: actorId,
      proposedProjectId: body.proposedProjectId,
      name: body.name,
      summary: body.summary,
      license: body.license,
      submittedAt: now(),
    });
  }, 201));

  app.get('/project-applications', route(async (context) => {
    const authentication = await authenticateHuman(context);
    const scope = context.req.query('scope') === 'pending' ? 'pending' : 'mine';
    if (scope === 'pending' && authentication.actor?.actorType !== 'maintainer') {
      throw new ProjectAdmissionError('community steward authorization is required', 'PROJECT_APPLICATION_STEWARD_FORBIDDEN', 403);
    }
    requiredRepositoryMethod(repository, 'listProjectApplications');
    const items = await repository.listProjectApplications({ viewerActorId: authentication.actorId, scope });
    return { scope, steward: authentication.actor?.actorType === 'maintainer', items: Array.isArray(items) ? items : [] };
  }));

  /* Membership read model: the roster of an open project is public; the
   * invitation list is the recipient's own, or the project's for its owners
   * and maintainers. */
  app.get('/projects/:projectId/members', route(async (context) => {
    requiredRepositoryMethod(repository, 'listProjectMembers');
    const items = await repository.listProjectMembers({ projectId: context.req.param('projectId') });
    return { items: Array.isArray(items) ? items : [] };
  }));

  app.get('/project-invitations', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    requiredRepositoryMethod(repository, 'listProjectInvitations');
    const projectId = context.req.query('projectId') || null;
    const items = await repository.listProjectInvitations({ viewerActorId: actorId, projectId });
    return { items: Array.isArray(items) ? items : [] };
  }));

  /* Managed Agents. A Human creates the Agent actors that will act for them;
   * the Agent never gets a human auth subject and cannot sign. */
  app.post('/actors/managed', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    const body = await requestBody(context);
    requiredRepositoryMethod(repository, 'createManagedAgent');
    return repository.createManagedAgent({
      ownerActorId: actorId,
      displayName: typeof body.displayName === 'string' ? body.displayName.trim() : '',
      modelName: typeof body.modelName === 'string' ? body.modelName.trim() : null,
      runtime: typeof body.runtime === 'string' ? body.runtime.trim() : null,
    });
  }, 201));

  app.delete('/actors/managed/:agentActorId', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    const body = await requestBody(context).catch(() => ({}));
    requiredRepositoryMethod(repository, 'retireManagedAgent');
    return repository.retireManagedAgent({
      ownerActorId: actorId,
      agentActorId: context.req.param('agentActorId'),
      reason: typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'retired by owner',
    });
  }));

  app.post('/projects/:projectId/agents', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    const body = await requestBody(context);
    requiredRepositoryMethod(repository, 'enrollProjectAgent');
    return repository.enrollProjectAgent({
      projectId: context.req.param('projectId'),
      agentActorId: body.agentActorId,
      enrolledByActorId: actorId,
    });
  }, 201));

  app.delete('/projects/:projectId/agents/:agentActorId', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    requiredRepositoryMethod(repository, 'removeProjectAgent');
    return repository.removeProjectAgent({
      projectId: context.req.param('projectId'),
      agentActorId: context.req.param('agentActorId'),
      removedByActorId: actorId,
    });
  }));

  app.post('/project-applications/:applicationId/withdraw', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    return withdrawProjectApplication({
      repository,
      applicationId: context.req.param('applicationId'),
      applicantActorId: actorId,
      withdrawnAt: now(),
    });
  }));

  app.post('/project-applications/:applicationId/decision', route(async (context) => {
    const authentication = await authenticateHuman(context);
    if (authentication.actor?.actorType !== 'maintainer') {
      throw new ProjectAdmissionError('community steward authorization is required', 'PROJECT_APPLICATION_STEWARD_FORBIDDEN', 403);
    }
    const body = await requestBody(context);
    return decideProjectApplication({
      repository,
      applicationId: context.req.param('applicationId'),
      stewardActorId: authentication.actorId,
      decision: body.decision,
      reason: body.reason,
      decidedAt: now(),
    });
  }));

  app.post('/projects/:projectId/invitations', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    const body = await requestBody(context);
    const projectId = context.req.param('projectId');
    const inviterRole = typeof repository.getProjectRole === 'function'
      ? await repository.getProjectRole({ projectId, actorId })
      : null;
    return createProjectInvitation({
      repository,
      projectId,
      invitedActorId: body.invitedActorId,
      invitedByActorId: actorId,
      inviterRole,
      invitedRole: body.role,
      expiresAt: body.expiresAt,
      createdAt: now(),
    });
  }, 201));

  app.post('/project-invitations/:invitationId/respond', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    const body = await requestBody(context);
    return respondToProjectInvitation({
      repository,
      invitationId: context.req.param('invitationId'),
      invitedActorId: actorId,
      response: body.response,
      respondedAt: now(),
    });
  }));

  app.post('/projects/:projectId/invitations/:invitationId/revoke', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    const body = await requestBody(context);
    const projectId = context.req.param('projectId');
    const revokerRole = typeof repository.getProjectRole === 'function'
      ? await repository.getProjectRole({ projectId, actorId })
      : null;
    return revokeProjectInvitation({
      repository,
      invitationId: context.req.param('invitationId'),
      revokedByActorId: actorId,
      revokerRole,
      reason: body.reason,
      revokedAt: now(),
    });
  }));

  app.patch('/projects/:projectId/members/:actorId', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    const body = await requestBody(context);
    const projectId = context.req.param('projectId');
    const changerRole = typeof repository.getProjectRole === 'function'
      ? await repository.getProjectRole({ projectId, actorId })
      : null;
    return changeProjectMembershipRole({
      repository,
      projectId,
      targetActorId: context.req.param('actorId'),
      changedByActorId: actorId,
      changerRole,
      nextRole: body.role,
      reason: body.reason,
      changedAt: now(),
    });
  }));

  app.delete('/projects/:projectId/members/:actorId', route(async (context) => {
    const { actorId } = await authenticateHuman(context);
    const body = await requestBody(context);
    const projectId = context.req.param('projectId');
    const removerRole = typeof repository.getProjectRole === 'function'
      ? await repository.getProjectRole({ projectId, actorId })
      : null;
    return removeProjectMembership({
      repository,
      projectId,
      targetActorId: context.req.param('actorId'),
      removedByActorId: actorId,
      removerRole,
      reason: body.reason,
      removedAt: now(),
    });
  }));

  return app;
}
