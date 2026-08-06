import assert from "node:assert/strict";
import test from "node:test";
import { FrontierContextCompileError } from "../src/frontier-context-compiler.mjs";
import { compileFullTraceContext } from "../src/full-trace-context-compiler.mjs";

const base = {
  taskRevision: { taskId: "task-1", revision: 1, title: "Trace task", description: "Public trace only", inputs: [], outputs: {}, acceptance: {} },
  frontierSnapshot: { snapshotId: "frontier-1", projectId: "project-1", sequence: 1, projectRevision: 1, checkpoint: {} },
  frontierMembers: [{ snapshotId: "frontier-1", claimId: "claim-1", claimRevision: 1, membershipType: "supporting", claimRevisionData: { claimId: "claim-1", revision: 1, state: "accepted", statement: "fixed", scope: {}, assumptions: [], falsification: {} } }],
};

test("Full Trace compiler includes canonical public Attempt Trace", () => {
  const bundle = compileFullTraceContext({ ...base, traceEvents: [
    { eventId: "trace-2", attemptId: "attempt-1", eventType: "attempt.progress", payload: { summary: "second", step: 2 }, hash: "sha256:two", parents: ["trace-1"], createdAt: "2026-08-06T00:00:02.000Z" },
    { eventId: "trace-1", attemptId: "attempt-1", eventType: "attempt.progress", payload: { summary: "first", step: 1 }, hash: "sha256:one", parents: [], createdAt: "2026-08-06T00:00:01.000Z" },
  ] });
  assert.equal(bundle.mode, "full_trace");
  assert.deepEqual(bundle.attemptTrace.map((event) => event.eventId), ["trace-1", "trace-2"]);
  assert.equal(bundle.attemptTrace[0].payload.summary, "first");
});

test("Full Trace compiler rejects private data even if a repository returns it", () => {
  assert.throws(() => compileFullTraceContext({ ...base, traceEvents: [
    { eventId: "trace-1", attemptId: "attempt-1", eventType: "attempt.progress", payload: { summary: "safe", secret: "leak" }, hash: "sha256:one", createdAt: "2026-08-06T00:00:01.000Z" },
  ] }), (error) => error instanceof FrontierContextCompileError && error.code === "TRACE_EVENT_PRIVATE");
});
