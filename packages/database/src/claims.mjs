import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';
import { questions } from './questions.mjs';

export const claimState = pgEnum('claim_state', [
  'hypothesis',
  'candidate',
  'under_verification',
  'provisionally_accepted',
  'accepted',
  'contested',
  'refuted',
  'superseded',
  'retracted',
  'dependency_tainted',
]);

export const claims = pgTable('claims', {
  claimId: text('claim_id').primaryKey(),
  questionId: text('question_id').references(() => questions.questionId, { onDelete: 'restrict' }),
  state: claimState('state').notNull().default('hypothesis'),
  createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
  ...createLifecycleColumns(),
});
