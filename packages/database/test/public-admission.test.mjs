import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { actors } from '../src/actors.mjs';
import { projectMembers } from '../src/project-members.mjs';
import { admissionAuditEvents, admissionFeatureGates, projectApplications, projectInvitations } from '../src/public-admission.mjs';
import { signingKeys } from '../src/signing-keys.mjs';

test('actor onboarding stores terms/profile completion but not a copied email-verification flag', () => {
  const columns = getTableColumns(actors);
  const config = getTableConfig(actors);
  assert.equal(columns.termsVersion.name, 'terms_version');
  assert.equal(columns.termsAcceptedAt.name, 'terms_accepted_at');
  assert.equal(columns.profileCompletedAt.name, 'profile_completed_at');
  assert.equal('emailVerified' in columns, false);
  assert.ok(config.checks.some((item) => item.name === 'actors_terms_acceptance_shape'));
  assert.ok(config.checks.some((item) => item.name === 'actors_profile_completion_requires_terms'));
});

test('signing keys retain only public material and explicit rotation metadata', () => {
  const columns = getTableColumns(signingKeys);
  const config = getTableConfig(signingKeys);
  assert.equal(columns.fingerprint.notNull, true);
  assert.equal(columns.label.notNull, true);
  assert.equal(columns.revocationReason.name, 'revocation_reason');
  assert.equal('privateKey' in columns, false);
  assert.ok(config.indexes.some((item) => item.config.name === 'signing_keys_one_active_per_actor' && item.config.unique));
  assert.ok(config.indexes.some((item) => item.config.name === 'signing_keys_fingerprint_unique' && item.config.unique));
  assert.ok(config.checks.some((item) => item.name === 'signing_keys_revocation_shape'));
});

test('project applications, invitations, gates, and audit events stay in the private schema', () => {
  for (const table of [projectApplications, projectInvitations, admissionFeatureGates, admissionAuditEvents]) {
    assert.equal(getTableConfig(table).schema, 'private');
  }
  assert.deepEqual(
    Object.keys(getTableColumns(projectApplications)),
    ['applicationId', 'applicantActorId', 'proposedProjectId', 'proposedName', 'proposedSummary', 'proposedLicense', 'status', 'submittedAt', 'decidedByActorId', 'decidedAt', 'decisionReason', 'withdrawnAt', 'approvedProjectId', 'updatedAt'],
  );
  assert.deepEqual(
    Object.keys(getTableColumns(projectInvitations)),
    ['invitationId', 'projectId', 'invitedActorId', 'invitedByActorId', 'role', 'status', 'createdAt', 'expiresAt', 'respondedAt', 'revokedByActorId', 'revokedAt', 'revocationReason', 'updatedAt'],
  );
  assert.equal(getTableColumns(admissionAuditEvents).details.columnType, 'PgJsonb');
  assert.equal(getTableColumns(admissionFeatureGates).enabled.default, false);
});

test('project membership has a typed active/removed lifecycle', () => {
  const columns = getTableColumns(projectMembers);
  const config = getTableConfig(projectMembers);
  assert.equal(columns.status.default, 'active');
  assert.equal(columns.joinedAt.notNull, true);
  assert.equal(columns.removedAt.notNull, false);
  assert.ok(config.checks.some((item) => item.name === 'project_members_role_allowed'));
  assert.ok(config.checks.some((item) => item.name === 'project_members_lifecycle_shape'));
});
