import { FrontierContextCompileError, compileFrontierContext } from "./frontier-context-compiler.mjs";

const PUBLIC_TRACE_FIELDS = new Set(["summary", "status", "phase", "duration_ms", "step", "metrics", "labels"]);

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FrontierContextCompileError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function canonicalJson(value, field) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new FrontierContextCompileError(`${field} must be JSON-serializable`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => canonicalJson(item, `${field}[${index}]`));
  if (typeof value !== "object") throw new FrontierContextCompileError(`${field} must be JSON-serializable`);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key], `${field}.${key}`)]));
}

function tracePayload(traceEvent) {
  if (!traceEvent || typeof traceEvent !== "object") throw new FrontierContextCompileError("trace event is required");
  const payload = traceEvent.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new FrontierContextCompileError("trace event payload must be an object");
  const privateFields = Object.keys(payload).filter((key) => !PUBLIC_TRACE_FIELDS.has(key));
  if (privateFields.length > 0) {
    throw new FrontierContextCompileError(`trace event contains non-public fields: ${privateFields.join(", ")}`, "TRACE_EVENT_PRIVATE");
  }
  return {
    eventId: requiredText(traceEvent.eventId, "trace event id"),
    attemptId: requiredText(traceEvent.attemptId, "trace attempt id"),
    eventType: requiredText(traceEvent.eventType, "trace event type"),
    payload: canonicalJson(payload, "trace event payload"),
    hash: requiredText(traceEvent.hash, "trace event hash"),
    parents: canonicalJson(traceEvent.parents ?? [], "trace event parents"),
    createdAt: requiredText(traceEvent.createdAt, "trace event created at"),
  };
}

/** Include only independently validated public Attempt Trace in a Frontier bundle. */
export function compileFullTraceContext({ traceEvents = [], ...frontierContext } = {}) {
  if (!Array.isArray(traceEvents)) throw new FrontierContextCompileError("trace events must be an array");
  const bundle = compileFrontierContext(frontierContext);
  const eventIds = new Set();
  const attemptTrace = traceEvents.map((event) => {
    const trace = tracePayload(event);
    if (eventIds.has(trace.eventId)) throw new FrontierContextCompileError("trace event is duplicated", "TRACE_EVENT_DUPLICATE");
    eventIds.add(trace.eventId);
    return trace;
  }).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.eventId.localeCompare(right.eventId));
  return { ...bundle, mode: "full_trace", attemptTrace };
}

/** Worker entry point for a full-trace context with repository-enforced public traces. */
export async function compileFullTraceContextJob({ repository, taskId, taskRevision, frontierSnapshotId } = {}) {
  const requiredMethods = ["getTaskRevision", "getFrontierSnapshot", "listFrontierMembers", "getClaimRevision", "listFrontierDependencies", "listPublicTraceEventsByTask"];
  if (!repository || requiredMethods.some((method) => typeof repository[method] !== "function")) {
    throw new FrontierContextCompileError("repository full trace context methods are required");
  }
  const traceEvents = await repository.listPublicTraceEventsByTask(requiredText(taskId, "task id"));
  return compileFullTraceContext({
    taskRevision: await repository.getTaskRevision(taskId, taskRevision),
    frontierSnapshot: await repository.getFrontierSnapshot(frontierSnapshotId),
    frontierMembers: await Promise.all((await repository.listFrontierMembers(frontierSnapshotId) ?? []).map(async (member) => ({
      ...member,
      claimRevisionData: await repository.getClaimRevision(member.claimId, member.claimRevision),
    }))),
    dependencies: await repository.listFrontierDependencies({ frontierSnapshotId }),
    traceEvents,
  });
}
