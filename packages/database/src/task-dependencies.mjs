import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  pgEnum,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';
import { tasks } from './tasks.mjs';

export const taskDependencyType = pgEnum('task_dependency_type', ['depends_on']);

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    sourceTaskId: text('source_task_id').notNull(),
    targetTaskId: text('target_task_id').notNull(),
    dependencyType: taskDependencyType('dependency_type').notNull().default('depends_on'),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    ...createLifecycleColumns(),
  },
  (table) => [
    primaryKey({ name: 'task_dependencies_pkey', columns: [table.sourceTaskId, table.targetTaskId] }),
    check('task_dependencies_no_self_reference', sql`${table.sourceTaskId} <> ${table.targetTaskId}`),
    foreignKey({
      name: 'task_dependencies_source_task_fk',
      columns: [table.sourceTaskId],
      foreignColumns: [tasks.taskId],
      onDelete: 'restrict',
    }),
    foreignKey({
      name: 'task_dependencies_target_task_fk',
      columns: [table.targetTaskId],
      foreignColumns: [tasks.taskId],
      onDelete: 'restrict',
    }),
  ],
);
