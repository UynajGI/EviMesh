import { paginate } from './pagination.mjs';

export class RunQueryError extends Error {
  constructor(message, code = 'RUN_QUERY_INVALID', status = 400) {
    super(message);
    this.name = 'RunQueryError';
    this.code = code;
    this.status = status;
  }
}

function optionalFilter(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.trim().length === 0) throw new RunQueryError(`${field} must be a non-empty string, null, or undefined`);
  return value.trim();
}

function requiredId(value) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new RunQueryError('run id must be a non-empty string');
  return value.trim();
}

function requireRepository(repository, methods, message) {
  if (!repository || methods.some((method) => typeof repository[method] !== 'function')) throw new RunQueryError(message);
}

export function canonicalRunArtifactRefs(refs, field = 'run artifact refs') {
  if (!Array.isArray(refs)) throw new RunQueryError(`${field} must be an array`, 'RUN_ARTIFACT_REFS_INVALID');
  const keyOf = (ref) => `${ref.artifactId}@${ref.artifactRevision}`;
  return [...refs].sort((left, right) => {
    const leftKey = keyOf(left);
    const rightKey = keyOf(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

export async function listRuns({ repository, taskId = null, actorId = null, limit = 20, cursor = null } = {}) {
  requireRepository(repository, ['listRuns'], 'repository listRuns is required');
  const runs = await repository.listRuns({ taskId: optionalFilter(taskId, 'task id'), actorId: optionalFilter(actorId, 'actor id') });
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RunQueryError('limit must be an integer between 1 and 100');
  if (cursor !== null && cursor !== undefined && (typeof cursor !== 'string' || cursor.length === 0)) throw new RunQueryError('cursor must be a non-empty string or null');
  return paginate(runs, { limit, cursor: cursor ?? null, getKey: (run) => ({ createdAt: run.startedAt, id: run.runId }) });
}

export async function getRun({ repository, runId } = {}) {
  runId = requiredId(runId);
  requireRepository(repository, ['getRun', 'listRunInputs', 'listRunOutputs'], 'repository run detail methods are required');
  const run = await repository.getRun(runId);
  if (!run) throw new RunQueryError('run not found', 'RUN_NOT_FOUND', 404);
  const [inputs, outputs] = await Promise.all([repository.listRunInputs(runId), repository.listRunOutputs(runId)]);
  return { run, inputs: canonicalRunArtifactRefs(inputs), outputs: canonicalRunArtifactRefs(outputs) };
}
