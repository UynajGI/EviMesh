export class AttemptQueryError extends Error {
  constructor(message, code = "ATTEMPT_QUERY_INVALID", status = 400) {
    super(message);
    this.name = "AttemptQueryError";
    this.code = code;
    this.status = status;
  }
}

function requiredId(value) {
  if (typeof value !== "string" || value.trim().length === 0) throw new AttemptQueryError("attempt id must be a non-empty string");
  return value.trim();
}

/** Return an Attempt with a bounded, non-payload trace summary. */
export async function getAttempt({ repository, attemptId } = {}) {
  attemptId = requiredId(attemptId);
  if (!repository || typeof repository.getAttempt !== "function" || typeof repository.listTraceEvents !== "function") {
    throw new AttemptQueryError("repository attempt detail methods are required");
  }
  const attempt = await repository.getAttempt(attemptId);
  if (!attempt) throw new AttemptQueryError("attempt not found", "ATTEMPT_NOT_FOUND", 404);
  const traceEvents = await repository.listTraceEvents(attemptId);
  const events = Array.isArray(traceEvents) ? traceEvents : [];
  const eventTypes = [...new Set(events.map((event) => event.eventType).filter((value) => typeof value === "string"))].sort();
  return {
    attempt,
    traceSummary: {
      count: events.length,
      eventTypes,
      firstEventAt: events[0]?.createdAt ?? null,
      lastEventAt: events.at(-1)?.createdAt ?? null,
    },
  };
}
