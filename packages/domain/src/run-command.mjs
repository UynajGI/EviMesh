import { assertProjectRoleForAction } from './project-authorization.mjs';

export class RunCommandError extends Error {
  constructor(message, code = 'RUN_INVALID', status = 400) {
    super(message);
    this.name = 'RunCommandError';
    this.code = code;
    this.status = status;
  }
}
function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new RunCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

function artifactRefs(values, field) {
  if (!Array.isArray(values)) throw new RunCommandError(`${field} must be an array`);
  const rows = values.map((value) => ({ runId: null, artifactId: requiredText(value?.artifactId, `${field}.artifactId`), artifactRevision: Number.isInteger(value?.artifactRevision) && value.artifactRevision > 0 ? value.artifactRevision : (() => { throw new RunCommandError(`${field}.artifactRevision must be positive`); })() }));
  if (new Set(rows.map((row) => `${row.artifactId}:${row.artifactRevision}`)).size !== rows.length) throw new RunCommandError(`${field} must not contain duplicate artifact revisions`);
  return rows;
}

async function assertArtifactRevisions(transaction, rows, field) {
  for (const row of rows) {
    if (!await transaction.getArtifactRevision(row.artifactId, row.artifactRevision)) {
      throw new RunCommandError(`${field} references an artifact revision that does not exist`, 'ARTIFACT_REVISION_NOT_FOUND', 404);
    }
  }
}

/** Persist a reproducibility Run and its immutable input/output artifact references. */
export async function createRun({ repository, actorId, actorRole, runId, taskId, contextBundleId, sourceCode, container, command, args = [], environment, hardware, randomSeed, startedAt, endedAt, networkAccess = false, exitCode, signature, inputs = [], outputs = [], eventFactory } = {}) {
  if (!repository || typeof repository.withTransaction !== 'function') throw new RunCommandError('repository withTransaction is required');
  for (const method of ['getArtifactRevision', 'insertRun', 'insertRunInput', 'insertRunOutput', 'appendResearchEvent']) if (typeof repository[method] !== 'function') throw new RunCommandError(`repository ${method} is required`);
  actorId = requiredText(actorId, 'actor id');
  runId = requiredText(runId, 'run id');
  taskId = requiredText(taskId, 'task id');
  contextBundleId = requiredText(contextBundleId, 'context bundle id');
  sourceCode = requiredText(sourceCode, 'source code');
  container = requiredText(container, 'container');
  command = requiredText(command, 'command');
  signature = requiredText(signature, 'signature');
  if (!Array.isArray(args)) throw new RunCommandError('args must be an array');
  if (environment === null || typeof environment !== 'object' || Array.isArray(environment)) throw new RunCommandError('environment must be a JSON object');
  if (hardware === null || typeof hardware !== 'object' || Array.isArray(hardware)) throw new RunCommandError('hardware must be a JSON object');
  if (randomSeed === null || typeof randomSeed !== 'object' || Array.isArray(randomSeed)) throw new RunCommandError('random seed must be a JSON object');
  if (!(startedAt instanceof Date) || !(endedAt instanceof Date) || Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime()) || endedAt < startedAt) throw new RunCommandError('run timestamps must be valid and ordered');
  if (typeof networkAccess !== 'boolean' || !Number.isInteger(exitCode)) throw new RunCommandError('network access and exit code are required');
  const inputRows = artifactRefs(inputs, 'inputs').map((row) => ({ ...row, runId }));
  const outputRows = artifactRefs(outputs, 'outputs').map((row) => ({ ...row, runId }));
  if (typeof eventFactory !== 'function') throw new RunCommandError('eventFactory is required');
  assertProjectRoleForAction({ actorRole, requiredRole: 'contributor' });
  const run = { runId, taskId, contextBundleId, sourceCode, container, command, args, environment, hardware, randomSeed, startedAt, endedAt, networkAccess, exitCode, createdBy: actorId, signature };
  return repository.withTransaction(async (transaction) => {
    await assertArtifactRevisions(transaction, inputRows, 'inputs');
    await assertArtifactRevisions(transaction, outputRows, 'outputs');
    const event = await eventFactory({ eventType: 'run.created', payload: { entity_type: 'run', run_id: runId, task_id: taskId, actor_id: actorId, input_count: inputRows.length, output_count: outputRows.length } });
    if (!event || typeof event !== 'object') throw new RunCommandError('eventFactory must return an event object');
    return {
      run: await transaction.insertRun(run) ?? run,
      inputs: await Promise.all(inputRows.map((row) => transaction.insertRunInput(row))),
      outputs: await Promise.all(outputRows.map((row) => transaction.insertRunOutput(row))),
      event: await transaction.appendResearchEvent(event) ?? event,
    };
  });
}
