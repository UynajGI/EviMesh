const SERVICE_ROLE = 'service_role';

export class PublicAdmissionRepositoryError extends Error {
  constructor(message, code = 'PUBLIC_ADMISSION_REPOSITORY_INVALID', status = 500) {
    super(message);
    this.name = 'PublicAdmissionRepositoryError';
    this.code = code;
    this.status = status;
  }
}

function assertSqlClient(sql) {
  if (typeof sql !== 'function' || typeof sql.begin !== 'function') {
    throw new PublicAdmissionRepositoryError('a Postgres.js client with begin() is required');
  }
}

async function asServiceRole(sql, callback) {
  return sql.begin(async (tx) => {
    if (typeof tx.unsafe !== 'function') throw new PublicAdmissionRepositoryError('Postgres transaction executor is invalid');
    await tx.unsafe('SET LOCAL ROLE service_role');
    const roleRows = await tx.unsafe('SELECT current_role::text AS "currentRole"');
    if (roleRows?.[0]?.currentRole !== SERVICE_ROLE) {
      throw new PublicAdmissionRepositoryError('repository must execute as service_role', 'PUBLIC_ADMISSION_SERVICE_ROLE_REQUIRED', 403);
    }
    return callback(tx);
  });
}

async function rpc(tx, name, values) {
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await tx.unsafe(`SELECT "public"."${name}"(${placeholders}) AS result`, values);
  return rows?.[0]?.result ?? null;
}

/**
 * Service-only repository for public-product account and project admission.
 * Every mutation is delegated to one allowlisted PostgreSQL RPC so locks,
 * state changes, and the immutable audit event commit atomically.
 */
export function createPublicAdmissionRepository(sql) {
  assertSqlClient(sql);
  const call = (name, values) => asServiceRole(sql, (tx) => rpc(tx, name, values));

  return Object.freeze({
    // 0086 deliberately has no legacy-only approval fallback. A later Graph
    // migration replaces this adapter only after its signed atomic RPC exists.
    projectApprovalGraphWriteReady: false,
    completeOnboarding: (input) => call('actor_onboarding_complete', [
      input.actorId,
      input.authSubject,
      input.termsVersion,
      input.acceptedAt,
      input.displayName,
      input.bio ?? null,
      input.avatarUrl ?? null,
    ]),
    listSigningKeys: (actorId) => call('signing_key_list', [actorId]),
    registerSigningKey: (input) => call('signing_key_register', [
      input.actorId,
      input.keyId,
      input.publicKey,
      input.label ?? 'Signing key',
      input.createdAt ?? new Date().toISOString(),
    ]),
    revokeSigningKey: (input) => call('signing_key_revoke', [
      input.actorId,
      input.keyId,
      input.reason,
      input.revokedAt ?? new Date().toISOString(),
    ]),
    submitProjectApplication: (input) => call('project_application_submit', [
      input.applicantActorId,
      input.proposedProjectId,
      input.name,
      input.summary,
      input.license,
      input.submittedAt,
    ]),
    withdrawProjectApplication: (input) => call('project_application_withdraw', [
      input.applicationId,
      input.applicantActorId,
      input.withdrawnAt,
    ]),
    decideProjectApplication: (input) => call('project_application_decide', [
      input.applicationId,
      input.stewardActorId,
      input.decision,
      input.reason,
      input.decidedAt,
    ]),
    createProjectInvitation: (input) => call('project_invitation_create', [
      input.projectId,
      input.invitedActorId,
      input.invitedByActorId,
      input.role,
      input.createdAt,
      input.expiresAt,
    ]),
    respondToProjectInvitation: (input) => call('project_invitation_respond', [
      input.invitationId,
      input.invitedActorId,
      input.response,
      input.respondedAt,
    ]),
    revokeProjectInvitation: (input) => call('project_invitation_revoke', [
      input.invitationId,
      input.revokedByActorId,
      input.reason,
      input.revokedAt,
    ]),
    changeProjectMembershipRole: (input) => call('project_membership_change_role', [
      input.projectId,
      input.targetActorId,
      input.changedByActorId,
      input.role,
      input.reason,
      input.changedAt,
    ]),
    removeProjectMembership: (input) => call('project_membership_remove', [
      input.projectId,
      input.targetActorId,
      input.removedByActorId,
      input.reason,
      input.removedAt,
    ]),
  });
}
