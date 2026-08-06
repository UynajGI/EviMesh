export class FrontierTaskSuggestionWorkerError extends Error {
  constructor(message, code = 'FRONTIER_TASK_SUGGESTION_INVALID') { super(message); this.name = 'FrontierTaskSuggestionWorkerError'; this.code = code; }
}

function text(value, field) { if (typeof value !== 'string' || !value.trim()) throw new FrontierTaskSuggestionWorkerError(`${field} must be a non-empty string`); return value.trim(); }

/** Create deduplicated open-blocker follow-up Task suggestions for a published Frontier. */
export async function createFrontierTaskSuggestionsJob({ repository, snapshotId, suggestionIdFactory } = {}) {
  const methods = ['getFrontierSnapshot', 'listFrontierOpenBlockers', 'listFrontierTaskSuggestions', 'createFrontierTaskSuggestion'];
  if (!repository || methods.some((method) => typeof repository[method] !== 'function')) throw new FrontierTaskSuggestionWorkerError('repository frontier suggestion methods are required');
  snapshotId = text(snapshotId, 'snapshot id');
  if (typeof suggestionIdFactory !== 'function') throw new FrontierTaskSuggestionWorkerError('suggestionIdFactory is required');
  const snapshot = await repository.getFrontierSnapshot(snapshotId);
  if (!snapshot) throw new FrontierTaskSuggestionWorkerError('frontier snapshot not found', 'FRONTIER_SNAPSHOT_NOT_FOUND');
  const blockers = await repository.listFrontierOpenBlockers(snapshotId);
  if (!Array.isArray(blockers)) throw new FrontierTaskSuggestionWorkerError('frontier blockers must be an array');
  const existing = await repository.listFrontierTaskSuggestions(snapshotId);
  const existingBlockerIds = new Set((Array.isArray(existing) ? existing : []).filter((suggestion) => suggestion?.type === 'open_blocker').map((suggestion) => suggestion.blockerId));
  const suggestions = [];
  for (const blocker of blockers) {
    const blockerId = text(blocker?.blockerId, 'blocker id');
    if (existingBlockerIds.has(blockerId)) continue;
    const suggestionId = text(await suggestionIdFactory({ snapshotId, blockerId }), 'suggestion id');
    const suggestion = await repository.createFrontierTaskSuggestion({ suggestionId, snapshotId, blockerId, type: 'open_blocker', title: text(blocker.title, 'blocker title') });
    suggestions.push(suggestion ?? { suggestionId, snapshotId, blockerId, type: 'open_blocker', title: blocker.title.trim() });
  }
  return Object.freeze({ snapshot, suggestions: Object.freeze(suggestions) });
}
