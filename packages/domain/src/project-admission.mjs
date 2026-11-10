import { assertProjectRoleForAction } from './project-authorization.mjs';
import { parseObjectId } from '../../protocol/src/object-id.mjs';

const INVITABLE_ROLES = new Set(['maintainer', 'contributor', 'viewer']);
const MEMBERSHIP_ROLES = new Set(['owner', 'maintainer', 'contributor', 'viewer']);

export class ProjectAdmissionError extends Error {
  constructor(message, code = 'PROJECT_ADMISSION_INVALID', status = 400) {
    super(message);
    this.name = 'ProjectAdmissionError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field, maxLength = 5000) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new ProjectAdmissionError(`${field} must be a non-empty string no longer than ${maxLength} characters`);
  }
  return value.trim();
}

function requiredMethod(repository, method) {
  if (!repository || typeof repository[method] !== 'function') {
    throw new ProjectAdmissionError(`repository ${method} is required`);
  }
  return repository;
}

function optionalReason(value, field = 'reason', maxLength = 1000) {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, field, maxLength);
}

function requiredReason(value, field = 'reason') {
  return requiredText(value, field, 1000);
}

function role(value, allowed, field = 'role') {
  if (!allowed.has(value)) throw new ProjectAdmissionError(`unsupported ${field}: ${String(value)}`, 'PROJECT_ROLE_INVALID');
  return value;
}

function instant(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new ProjectAdmissionError(`${field} must be a valid timestamp`);
  return date.toISOString();
}

function canonicalProjectId(value) {
  const candidate = requiredText(value, 'proposed project id', 100);
  try {
    const parsed = parseObjectId(candidate);
    const canonical = `project_${parsed.uuid}`;
    if (parsed.kind !== 'Project' || candidate !== canonical) throw new TypeError('not canonical');
    return canonical;
  } catch {
    throw new ProjectAdmissionError('proposed project id must match canonical project_<uuid> syntax');
  }
}

export async function submitProjectApplication({ repository, applicantActorId, proposedProjectId, name, summary, license, submittedAt = new Date() } = {}) {
  requiredMethod(repository, 'submitProjectApplication');
  return repository.submitProjectApplication({
    applicantActorId: requiredText(applicantActorId, 'applicant actor id', 200),
    proposedProjectId: canonicalProjectId(proposedProjectId),
    name: requiredText(name, 'project name', 200),
    summary: requiredText(summary, 'project summary', 4000),
    license: requiredText(license, 'project license', 200),
    submittedAt: instant(submittedAt, 'submitted at'),
  });
}

export async function withdrawProjectApplication({ repository, applicationId, applicantActorId, withdrawnAt = new Date() } = {}) {
  requiredMethod(repository, 'withdrawProjectApplication');
  return repository.withdrawProjectApplication({
    applicationId: requiredText(applicationId, 'application id', 100),
    applicantActorId: requiredText(applicantActorId, 'applicant actor id', 200),
    withdrawnAt: instant(withdrawnAt, 'withdrawn at'),
  });
}

export async function decideProjectApplication({ repository, applicationId, stewardActorId, decision, reason, decidedAt = new Date() } = {}) {
  requiredMethod(repository, 'decideProjectApplication');
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new ProjectAdmissionError('decision must be approved or rejected');
  }
  if (decision === 'approved' && repository.projectApprovalGraphWriteReady !== true) {
    throw new ProjectAdmissionError(
      'project approval is unavailable until atomic signed Graph/Event creation is installed',
      'PROJECT_APPROVAL_GRAPH_WRITE_NOT_READY',
      503,
    );
  }
  return repository.decideProjectApplication({
    applicationId: requiredText(applicationId, 'application id', 100),
    stewardActorId: requiredText(stewardActorId, 'steward actor id', 200),
    decision,
    reason: requiredReason(reason, 'decision reason'),
    decidedAt: instant(decidedAt, 'decided at'),
  });
}

export async function createProjectInvitation({ repository, projectId, invitedActorId, invitedByActorId, inviterRole, invitedRole, expiresAt, createdAt = new Date() } = {}) {
  requiredMethod(repository, 'createProjectInvitation');
  try {
    assertProjectRoleForAction({ actorRole: inviterRole, requiredRole: 'maintainer' });
  } catch (error) {
    throw new ProjectAdmissionError(error.message, error.code ?? 'PROJECT_FORBIDDEN', 403);
  }
  return repository.createProjectInvitation({
    projectId: requiredText(projectId, 'project id', 100),
    invitedActorId: requiredText(invitedActorId, 'invited actor id', 200),
    invitedByActorId: requiredText(invitedByActorId, 'inviter actor id', 200),
    role: role(invitedRole, INVITABLE_ROLES, 'invited role'),
    createdAt: instant(createdAt, 'created at'),
    expiresAt: instant(expiresAt, 'expires at'),
  });
}

export async function respondToProjectInvitation({ repository, invitationId, invitedActorId, response, respondedAt = new Date() } = {}) {
  requiredMethod(repository, 'respondToProjectInvitation');
  if (response !== 'accepted' && response !== 'declined') {
    throw new ProjectAdmissionError('response must be accepted or declined');
  }
  return repository.respondToProjectInvitation({
    invitationId: requiredText(invitationId, 'invitation id', 100),
    invitedActorId: requiredText(invitedActorId, 'invited actor id', 200),
    response,
    respondedAt: instant(respondedAt, 'responded at'),
  });
}

export async function revokeProjectInvitation({ repository, invitationId, revokedByActorId, revokerRole, reason, revokedAt = new Date() } = {}) {
  requiredMethod(repository, 'revokeProjectInvitation');
  try {
    assertProjectRoleForAction({ actorRole: revokerRole, requiredRole: 'maintainer' });
  } catch (error) {
    throw new ProjectAdmissionError(error.message, error.code ?? 'PROJECT_FORBIDDEN', 403);
  }
  return repository.revokeProjectInvitation({
    invitationId: requiredText(invitationId, 'invitation id', 100),
    revokedByActorId: requiredText(revokedByActorId, 'revoker actor id', 200),
    reason: requiredReason(reason, 'revocation reason'),
    revokedAt: instant(revokedAt, 'revoked at'),
  });
}

export async function changeProjectMembershipRole({ repository, projectId, targetActorId, changedByActorId, changerRole, nextRole, reason, changedAt = new Date() } = {}) {
  requiredMethod(repository, 'changeProjectMembershipRole');
  try {
    assertProjectRoleForAction({ actorRole: changerRole, requiredRole: 'owner' });
  } catch (error) {
    throw new ProjectAdmissionError(error.message, error.code ?? 'PROJECT_FORBIDDEN', 403);
  }
  return repository.changeProjectMembershipRole({
    projectId: requiredText(projectId, 'project id', 100),
    targetActorId: requiredText(targetActorId, 'target actor id', 200),
    changedByActorId: requiredText(changedByActorId, 'changing actor id', 200),
    role: role(nextRole, MEMBERSHIP_ROLES, 'membership role'),
    reason: requiredReason(reason),
    changedAt: instant(changedAt, 'changed at'),
  });
}

export async function removeProjectMembership({ repository, projectId, targetActorId, removedByActorId, removerRole, reason, removedAt = new Date() } = {}) {
  requiredMethod(repository, 'removeProjectMembership');
  if (removerRole !== 'owner' && removerRole !== 'maintainer') {
    throw new ProjectAdmissionError('project role is insufficient', 'PROJECT_FORBIDDEN', 403);
  }
  return repository.removeProjectMembership({
    projectId: requiredText(projectId, 'project id', 100),
    targetActorId: requiredText(targetActorId, 'target actor id', 200),
    removedByActorId: requiredText(removedByActorId, 'removing actor id', 200),
    reason: requiredReason(reason),
    removedAt: instant(removedAt, 'removed at'),
  });
}
