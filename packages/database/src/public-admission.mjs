import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { privateSchema } from './device-authorizations.mjs';
import { projects } from './projects.mjs';

/** Project-creation review. This is governance state, never a research node. */
export const projectApplications = privateSchema.table(
  'project_applications',
  {
    applicationId: uuid('application_id').defaultRandom().primaryKey(),
    applicantActorId: text('applicant_actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    proposedProjectId: text('proposed_project_id').notNull(),
    proposedName: text('proposed_name').notNull(),
    proposedSummary: text('proposed_summary').notNull(),
    proposedLicense: text('proposed_license').notNull(),
    status: text('status').notNull().default('pending'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    decidedByActorId: text('decided_by_actor_id')
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionReason: text('decision_reason'),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    approvedProjectId: text('approved_project_id')
      .references(() => projects.projectId, { onDelete: 'restrict' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('project_applications_one_pending_actor')
      .on(table.applicantActorId)
      .where(sql`${table.status} = 'pending'`),
    uniqueIndex('project_applications_one_pending_project_id')
      .on(table.proposedProjectId)
      .where(sql`${table.status} = 'pending'`),
    uniqueIndex('project_applications_approved_project_unique')
      .on(table.approvedProjectId)
      .where(sql`${table.approvedProjectId} is not null`),
    index('project_applications_status_submitted_idx').on(table.status, table.submittedAt),
    check('project_applications_status_allowed', sql`${table.status} in ('pending', 'approved', 'rejected', 'withdrawn')`),
    check('project_applications_project_id_canonical', sql`${table.proposedProjectId} ~ '^project_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`),
    check('project_applications_name_length', sql`char_length(${table.proposedName}) between 1 and 200`),
    check('project_applications_summary_length', sql`char_length(${table.proposedSummary}) between 1 and 4000`),
    check('project_applications_license_length', sql`char_length(${table.proposedLicense}) between 1 and 200`),
    check(
      'project_applications_lifecycle_shape',
      sql`
        (${table.status} = 'pending' and ${table.decidedByActorId} is null and ${table.decidedAt} is null and ${table.decisionReason} is null and ${table.withdrawnAt} is null and ${table.approvedProjectId} is null)
        or (${table.status} = 'approved' and ${table.decidedByActorId} is not null and ${table.decidedAt} is not null and ${table.decisionReason} is not null and char_length(${table.decisionReason}) between 1 and 1000 and ${table.withdrawnAt} is null and ${table.approvedProjectId} is not null)
        or (${table.status} = 'rejected' and ${table.decidedByActorId} is not null and ${table.decidedAt} is not null and ${table.decisionReason} is not null and char_length(${table.decisionReason}) between 1 and 1000 and ${table.withdrawnAt} is null and ${table.approvedProjectId} is null)
        or (${table.status} = 'withdrawn' and ${table.decidedByActorId} is null and ${table.decidedAt} is null and ${table.decisionReason} is null and ${table.withdrawnAt} is not null and ${table.approvedProjectId} is null)
      `,
    ),
  ],
);

/** Role-scoped invitation. Project membership remains the authoritative role. */
export const projectInvitations = privateSchema.table(
  'project_invitations',
  {
    invitationId: uuid('invitation_id').defaultRandom().primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.projectId, { onDelete: 'restrict' }),
    invitedActorId: text('invited_actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    invitedByActorId: text('invited_by_actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    role: text('role').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    revokedByActorId: text('revoked_by_actor_id')
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revocationReason: text('revocation_reason'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('project_invitations_one_pending_recipient')
      .on(table.projectId, table.invitedActorId)
      .where(sql`${table.status} = 'pending'`),
    index('project_invitations_recipient_status_idx').on(table.invitedActorId, table.status),
    index('project_invitations_expiry_idx').on(table.expiresAt),
    check('project_invitations_role_allowed', sql`${table.role} in ('maintainer', 'contributor', 'viewer')`),
    check('project_invitations_status_allowed', sql`${table.status} in ('pending', 'accepted', 'declined', 'expired', 'revoked')`),
    check('project_invitations_expiry_after_creation', sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      'project_invitations_lifecycle_shape',
      sql`
        (${table.status} = 'pending' and ${table.respondedAt} is null and ${table.revokedByActorId} is null and ${table.revokedAt} is null and ${table.revocationReason} is null)
        or (${table.status} in ('accepted', 'declined', 'expired') and ${table.respondedAt} is not null and ${table.revokedByActorId} is null and ${table.revokedAt} is null and ${table.revocationReason} is null)
        or (${table.status} = 'revoked' and ${table.respondedAt} is null and ${table.revokedByActorId} is not null and ${table.revokedAt} is not null and ${table.revocationReason} is not null and char_length(${table.revocationReason}) between 1 and 500)
      `,
    ),
  ],
);

/** Deployment-owned fail-closed gates. Public API roles receive no access. */
export const admissionFeatureGates = privateSchema.table(
  'admission_feature_gates',
  {
    gate: text('gate').primaryKey(),
    enabled: boolean('enabled').notNull().default(false),
    updatedBy: text('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('admission_feature_gates_name_allowed', sql`${table.gate} in ('project_approval_graph_write')`),
  ],
);

/** Append-only governance/account audit events, explicitly outside the DAG. */
export const admissionAuditEvents = privateSchema.table(
  'admission_audit_events',
  {
    eventId: uuid('event_id').defaultRandom().primaryKey(),
    eventType: text('event_type').notNull(),
    actorId: text('actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    details: jsonb('details').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('admission_audit_events_subject_time_idx').on(table.subjectType, table.subjectId, table.occurredAt),
    index('admission_audit_events_actor_time_idx').on(table.actorId, table.occurredAt),
    check(
      'admission_audit_events_type_allowed',
      sql`${table.eventType} in ('onboarding.completed', 'signing_key.registered', 'signing_key.revoked', 'project_application.submitted', 'project_application.withdrawn', 'project_application.approved', 'project_application.rejected', 'project_invitation.created', 'project_invitation.accepted', 'project_invitation.declined', 'project_invitation.expired', 'project_invitation.revoked', 'project_membership.role_changed', 'project_membership.removed', 'project_membership.reactivated')`,
    ),
    check('admission_audit_events_subject_type_allowed', sql`${table.subjectType} in ('actor', 'signing_key', 'project_application', 'project_invitation', 'project_membership')`),
  ],
);
