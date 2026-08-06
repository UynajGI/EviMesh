import assert from "node:assert/strict";
import test from "node:test";
import { ContextAccessAuditError, recordContextBundleAccess } from "../src/context-access-audit.mjs";

const contextBundle = { contextBundleId: "context-1", taskId: "task-1", mode: "blind", contentHash: `sha256:${"a".repeat(64)}` };

test("restricted ContextBundle access appends an auditable ResearchEvent", async () => {
  const calls = [];
  const repository = { withTransaction: async (callback) => callback(repository), appendResearchEvent: async (event) => { calls.push(event); return event; } };
  const result = await recordContextBundleAccess({ repository, actorId: "actor-1", contextBundle, accessRestricted: true, reason: "download", eventFactory: async (event) => event });
  assert.equal(result.audited, true);
  assert.equal(result.event.eventType, "context_bundle.accessed");
  assert.deepEqual(calls[0].payload, { entity_type: "context_bundle", context_bundle_id: "context-1", task_id: "task-1", mode: "blind", content_hash: contextBundle.contentHash, actor_id: "actor-1", access_reason: "download" });
});

test("unrestricted access does not create an audit event", async () => {
  const result = await recordContextBundleAccess({ accessRestricted: false });
  assert.deepEqual(result, { audited: false });
});

test("restricted access fails closed without a complete audit envelope", async () => {
  await assert.rejects(() => recordContextBundleAccess({ accessRestricted: true, repository: {}, actorId: "actor-1", contextBundle, eventFactory: async (event) => event }), ContextAccessAuditError);
  await assert.rejects(() => recordContextBundleAccess({ accessRestricted: true, repository: { withTransaction: async (callback) => callback({ appendResearchEvent: async () => ({}) }), appendResearchEvent: async () => ({}) }, actorId: "actor-1", contextBundle: { ...contextBundle, contentHash: "" }, eventFactory: async (event) => event }), ContextAccessAuditError);
});
