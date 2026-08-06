export class ResearchEventExportError extends Error {
  constructor(message, code = 'RESEARCH_EVENT_EXPORT_INVALID', status = 400) {
    super(message);
    this.name = 'ResearchEventExportError';
    this.code = code;
    this.status = status;
  }
}

function requiredEventId(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ResearchEventExportError(`${field} event id must be a non-empty string`);
  }
  return value.trim();
}

function assertContiguousRange(events, { firstEventId, lastEventId }) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new ResearchEventExportError('research event range is empty', 'RESEARCH_EVENT_RANGE_EMPTY', 404);
  }
  if (events[0]?.eventId !== firstEventId || events.at(-1)?.eventId !== lastEventId) {
    throw new ResearchEventExportError('research event range does not include both requested boundaries', 'RESEARCH_EVENT_RANGE_INCOMPLETE', 409);
  }
  const eventIds = events.map((event) => event?.eventId);
  if (eventIds.some((eventId) => typeof eventId !== 'string' || eventId.length === 0) || new Set(eventIds).size !== eventIds.length) {
    throw new ResearchEventExportError('research event range is not contiguous', 'RESEARCH_EVENT_RANGE_INCOMPLETE', 409);
  }
}

/** Export the inclusive, repository-defined contiguous Event range as newline-delimited JSON. */
export async function exportResearchEventRangeNdjson({ repository, firstEventId, lastEventId } = {}) {
  if (!repository || typeof repository.listResearchEventRange !== 'function') {
    throw new ResearchEventExportError('repository listResearchEventRange is required');
  }
  firstEventId = requiredEventId(firstEventId, 'first');
  lastEventId = requiredEventId(lastEventId, 'last');
  const events = await repository.listResearchEventRange({ firstEventId, lastEventId });
  assertContiguousRange(events, { firstEventId, lastEventId });
  return `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;
}
