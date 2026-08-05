import test from "node:test";
import assert from "node:assert/strict";
import { getAttempt } from "../src/attempt-query.mjs";

test("returns an Attempt and a non-payload trace summary", async () => {
  const repository = {
    getAttempt: async () => ({ attemptId: "attempt-1", taskId: "task-1", state: "active" }),
    listTraceEvents: async () => [
      { eventType: "trace.started", payload: { secret: true }, createdAt: "2026-08-06T00:00:00.000Z" },
      { eventType: "trace.started", payload: { secret: true }, createdAt: "2026-08-06T00:01:00.000Z" },
      { eventType: "trace.finished", payload: { secret: true }, createdAt: "2026-08-06T00:02:00.000Z" },
    ],
  };
  const result = await getAttempt({ repository, attemptId: "attempt-1" });
  assert.equal(result.attempt.state, "active");
  assert.deepEqual(result.traceSummary, {
    count: 3,
    eventTypes: ["trace.finished", "trace.started"],
    firstEventAt: "2026-08-06T00:00:00.000Z",
    lastEventAt: "2026-08-06T00:02:00.000Z",
  });
  assert.equal("payload" in result.traceSummary, false);
});

test("returns a typed error for a missing Attempt", async () => {
  const repository = { getAttempt: async () => null, listTraceEvents: async () => [] };
  await assert.rejects(
    getAttempt({ repository, attemptId: "attempt-1" }),
    (error) => error.code === "ATTEMPT_NOT_FOUND" && error.status === 404,
  );
});
