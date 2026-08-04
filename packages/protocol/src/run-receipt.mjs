function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function frozenArray(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array`);
  }
  return Object.freeze([...value]);
}

function frozenObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return Object.freeze({ ...value });
}

export function createRunReceipt({
  taskId,
  contextBundleId,
  inputArtifactIds = [],
  sourceCode,
  container,
  command,
  args = [],
  environment,
  hardware,
  randomSeed,
  startedAt,
  endedAt,
  networkAccess,
  outputArtifactIds = [],
  exitCode,
  actorId,
  signature,
} = {}) {
  requireString(taskId, 'task ID');
  requireString(contextBundleId, 'context bundle ID');
  requireString(sourceCode, 'source code');
  requireString(container, 'container');
  requireString(command, 'command');
  requireString(startedAt, 'start time');
  requireString(endedAt, 'end time');
  requireString(actorId, 'actor ID');
  requireString(signature, 'signature');

  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    throw new RangeError('run receipt timestamps must be valid and ordered');
  }
  if (typeof networkAccess !== 'boolean') {
    throw new TypeError('network access must be a boolean');
  }
  if (!Number.isInteger(exitCode)) {
    throw new TypeError('exit code must be an integer');
  }
  if (randomSeed === undefined || randomSeed === null) {
    throw new TypeError('random seed is required');
  }

  return Object.freeze({
    task_id: taskId,
    context_bundle_id: contextBundleId,
    input_artifact_ids: frozenArray(inputArtifactIds, 'input artifacts'),
    source_code: sourceCode,
    container,
    command,
    args: frozenArray(args, 'command arguments'),
    environment: frozenObject(environment, 'environment'),
    hardware: frozenObject(hardware, 'hardware'),
    random_seed: randomSeed,
    started_at: startedAt,
    ended_at: endedAt,
    network_access: networkAccess,
    output_artifact_ids: frozenArray(outputArtifactIds, 'output artifacts'),
    exit_code: exitCode,
    actor_id: actorId,
    signature,
  });
}
