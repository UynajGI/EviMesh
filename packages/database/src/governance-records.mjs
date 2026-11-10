import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { privateSchema } from './device-authorizations.mjs';
import { projects } from './projects.mjs';

/** A user report. Governance records are private audit state, never DAG nodes. */
export const moderationCases = privateSchema.table(
  'moderation_cases',
  {
    caseId: uuid('case_id').defaultRandom().primaryKey(),
    reporterActorId: text('reporter_actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    projectId: text('project_id').references(() => projects.projectId, { onDelete: 'restrict' }),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    subjectRevision: integer('subject_revision'),
    category: text('category').notNull(),
    reason: text('reason').notNull(),
    details: jsonb('details').notNull().default({}),
    status: text('status').notNull().default('open'),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('moderation_cases_reporter_idempotency_unique').on(table.reporterActorId, table.idempotencyKey),
    index('moderation_cases_status_created_idx').on(table.status, table.createdAt),
    index('moderation_cases_subject_idx').on(table.subjectType, table.subjectId, table.subjectRevision),
    check('moderation_cases_subject_type_allowed', sql`${table.subjectType} in ('research_node','artifact','actor','project')`),
    check('moderation_cases_subject_revision_shape', sql`(${table.subjectType} in ('research_node','artifact') and ${table.subjectRevision} > 0) or (${table.subjectType} in ('actor','project') and ${table.subjectRevision} is null)`),
    check('moderation_cases_category_allowed', sql`${table.category} in ('illegal_content','copyright','privacy','security','research_integrity','acceptable_use','other')`),
    check('moderation_cases_status_allowed', sql`${table.status} in ('open','under_review','actioned','dismissed','closed')`),
    check('moderation_cases_reason_length', sql`char_length(${table.reason}) between 1 and 4000`),
    check('moderation_cases_details_object', sql`jsonb_typeof(${table.details}) = 'object'`),
    check('moderation_cases_idempotency_length', sql`char_length(${table.idempotencyKey}) between 8 and 200`),
  ],
);

/** Immutable community or platform-emergency action. Reviews are separate decisions. */
export const moderationActions = privateSchema.table(
  'moderation_actions',
  {
    actionId: uuid('action_id').defaultRandom().primaryKey(),
    caseId: uuid('case_id').notNull().references(() => moderationCases.caseId, { onDelete: 'restrict' }),
    actorId: text('actor_id').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    authority: text('authority').notNull(),
    actionType: text('action_type').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    subjectRevision: integer('subject_revision'),
    scope: jsonb('scope').notNull().default({}),
    reason: text('reason').notNull(),
    initialReviewStatus: text('initial_review_status').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('moderation_actions_actor_idempotency_unique').on(table.actorId, table.idempotencyKey),
    index('moderation_actions_case_created_idx').on(table.caseId, table.createdAt),
    check('moderation_actions_authority_allowed', sql`${table.authority} in ('community','platform_emergency')`),
    check('moderation_actions_type_allowed', sql`${table.actionType} in ('restrict_discovery','restore_discovery','restrict_access','restore_access','block_artifact_download','restore_artifact_download','dismiss_case','close_case','request_more_info')`),
    check('moderation_actions_scope_object', sql`jsonb_typeof(${table.scope}) = 'object'`),
    check('moderation_actions_reason_length', sql`char_length(${table.reason}) between 1 and 4000`),
    check('moderation_actions_review_shape', sql`(${table.authority} = 'platform_emergency' and ${table.initialReviewStatus} = 'pending') or (${table.authority} = 'community' and ${table.initialReviewStatus} = 'not_required')`),
  ],
);

/** An appellant-owned request. Its final decision is appended separately. */
export const appeals = privateSchema.table(
  'appeals',
  {
    appealId: uuid('appeal_id').defaultRandom().primaryKey(),
    caseId: uuid('case_id').notNull().references(() => moderationCases.caseId, { onDelete: 'restrict' }),
    actionId: uuid('action_id').notNull().references(() => moderationActions.actionId, { onDelete: 'restrict' }),
    appellantActorId: text('appellant_actor_id').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    idempotencyKey: text('idempotency_key').notNull(),
    decidedByActorId: text('decided_by_actor_id').references(() => actors.actorId, { onDelete: 'restrict' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionReason: text('decision_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('appeals_appellant_idempotency_unique').on(table.appellantActorId, table.idempotencyKey),
    uniqueIndex('appeals_action_appellant_unique').on(table.actionId, table.appellantActorId),
    index('appeals_status_created_idx').on(table.status, table.createdAt),
    check('appeals_status_allowed', sql`${table.status} in ('pending','upheld','denied')`),
    check('appeals_reason_length', sql`char_length(${table.reason}) between 1 and 4000`),
    check('appeals_decision_shape', sql`(${table.status} = 'pending' and ${table.decidedByActorId} is null and ${table.decidedAt} is null and ${table.decisionReason} is null) or (${table.status} in ('upheld','denied') and ${table.decidedByActorId} is not null and ${table.decidedAt} is not null and char_length(${table.decisionReason}) between 1 and 4000)`),
  ],
);

/** Append-only review and appeal outcomes. */
export const moderationDecisions = privateSchema.table(
  'moderation_decisions',
  {
    decisionId: uuid('decision_id').defaultRandom().primaryKey(),
    caseId: uuid('case_id').notNull().references(() => moderationCases.caseId, { onDelete: 'restrict' }),
    actionId: uuid('action_id').references(() => moderationActions.actionId, { onDelete: 'restrict' }),
    appealId: uuid('appeal_id').references(() => appeals.appealId, { onDelete: 'restrict' }),
    actorId: text('actor_id').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    decisionType: text('decision_type').notNull(),
    outcome: text('outcome').notNull(),
    reason: text('reason').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('moderation_decisions_actor_idempotency_unique').on(table.actorId, table.idempotencyKey),
    uniqueIndex('moderation_decisions_action_review_unique').on(table.actionId).where(sql`${table.decisionType} = 'action_review'`),
    uniqueIndex('moderation_decisions_appeal_unique').on(table.appealId).where(sql`${table.decisionType} = 'appeal'`),
    check('moderation_decisions_type_allowed', sql`${table.decisionType} in ('action_review','appeal')`),
    check('moderation_decisions_outcome_allowed', sql`${table.outcome} in ('confirmed','reversed','upheld','denied')`),
    check('moderation_decisions_target_shape', sql`(${table.decisionType} = 'action_review' and ${table.actionId} is not null and ${table.appealId} is null and ${table.outcome} in ('confirmed','reversed')) or (${table.decisionType} = 'appeal' and ${table.actionId} is not null and ${table.appealId} is not null and ${table.outcome} in ('upheld','denied'))`),
    check('moderation_decisions_reason_length', sql`char_length(${table.reason}) between 1 and 4000`),
  ],
);

/** Append-only effective-state overlays; a download restriction is a byte tombstone. */
export const contentAccessOverlays = privateSchema.table(
  'content_access_overlays',
  {
    overlayId: uuid('overlay_id').defaultRandom().primaryKey(),
    overlaySequence: bigint('overlay_sequence', { mode: 'number' }).notNull(),
    sourceKey: text('source_key').notNull(),
    actionId: uuid('action_id').notNull().references(() => moderationActions.actionId, { onDelete: 'restrict' }),
    decisionId: uuid('decision_id').references(() => moderationDecisions.decisionId, { onDelete: 'restrict' }),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    subjectRevision: integer('subject_revision'),
    restriction: text('restriction').notNull(),
    operation: text('operation').notNull(),
    byteTombstone: boolean('byte_tombstone').notNull().default(false),
    preservedContentHash: text('preserved_content_hash'),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('content_access_overlays_sequence_unique').on(table.overlaySequence),
    uniqueIndex('content_access_overlays_source_key_unique').on(table.sourceKey),
    index('content_access_overlays_subject_sequence_idx').on(table.subjectType, table.subjectId, table.subjectRevision, table.overlaySequence),
    check('content_access_overlays_restriction_allowed', sql`${table.restriction} in ('discovery','access','download')`),
    check('content_access_overlays_operation_allowed', sql`${table.operation} in ('restrict','restore')`),
    check('content_access_overlays_tombstone_shape', sql`(${table.restriction} = 'download' and ${table.subjectType} = 'artifact' and ${table.subjectRevision} > 0 and ${table.byteTombstone} and ${table.preservedContentHash} ~ '^sha256:[0-9a-f]{64}$') or (${table.restriction} <> 'download' and not ${table.byteTombstone} and ${table.preservedContentHash} is null)`),
    check('content_access_overlays_reason_length', sql`char_length(${table.reason}) between 1 and 4000`),
  ],
);

export const accountExports = privateSchema.table(
  'account_exports',
  {
    exportRequestId: uuid('export_request_id').defaultRandom().primaryKey(),
    requesterActorId: text('requester_actor_id').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    format: text('format').notNull().default('json'),
    status: text('status').notNull().default('pending'),
    idempotencyKey: text('idempotency_key').notNull(),
    resultLocator: text('result_locator'),
    contentHash: text('content_hash'),
    failureReason: text('failure_reason'),
    processedByActorId: text('processed_by_actor_id').references(() => actors.actorId, { onDelete: 'restrict' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('account_exports_requester_idempotency_unique').on(table.requesterActorId, table.idempotencyKey),
    index('account_exports_status_requested_idx').on(table.status, table.requestedAt),
    check('account_exports_format_allowed', sql`${table.format} = 'json'`),
    check('account_exports_status_allowed', sql`${table.status} in ('pending','processing','ready','failed','expired','cancelled')`),
    check('account_exports_content_hash_shape', sql`${table.contentHash} is null or ${table.contentHash} ~ '^sha256:[0-9a-f]{64}$'`),
  ],
);

export const accountDeletionRequests = privateSchema.table(
  'account_deletion_requests',
  {
    deletionRequestId: uuid('deletion_request_id').defaultRandom().primaryKey(),
    requesterActorId: text('requester_actor_id').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    reason: text('reason'),
    status: text('status').notNull().default('pending'),
    idempotencyKey: text('idempotency_key').notNull(),
    processedByActorId: text('processed_by_actor_id').references(() => actors.actorId, { onDelete: 'restrict' }),
    decisionReason: text('decision_reason'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('account_deletion_requests_requester_idempotency_unique').on(table.requesterActorId, table.idempotencyKey),
    uniqueIndex('account_deletion_requests_one_active_actor').on(table.requesterActorId).where(sql`${table.status} in ('pending','processing')`),
    index('account_deletion_requests_status_requested_idx').on(table.status, table.requestedAt),
    check('account_deletion_requests_status_allowed', sql`${table.status} in ('pending','processing','completed','rejected','cancelled')`),
    check('account_deletion_requests_reason_length', sql`${table.reason} is null or char_length(${table.reason}) between 1 and 4000`),
  ],
);

/** Cross-model immutable operation history and idempotency receipts. */
export const governanceAuditEvents = privateSchema.table(
  'governance_audit_events',
  {
    eventId: uuid('event_id').defaultRandom().primaryKey(),
    eventType: text('event_type').notNull(),
    actorId: text('actor_id').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    request: jsonb('request').notNull(),
    result: jsonb('result').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('governance_audit_events_actor_idempotency_unique').on(table.actorId, table.idempotencyKey),
    index('governance_audit_events_subject_time_idx').on(table.subjectType, table.subjectId, table.occurredAt),
    check('governance_audit_events_request_object', sql`jsonb_typeof(${table.request}) = 'object'`),
    check('governance_audit_events_result_object', sql`jsonb_typeof(${table.result}) = 'object'`),
  ],
);
