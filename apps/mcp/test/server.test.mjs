import test from "node:test";
import assert from "node:assert/strict";
import { createMcpServer } from "../src/server.mjs";
import { roundtrip, createFakeClient } from "./helpers.mjs";

function rpc(id, method, params = {}) {
  return { jsonrpc: "2.0", id, method, params };
}

test("initialize negotiates a supported protocol version", async () => {
  const handle = createMcpServer({ client: createFakeClient() });
  const [response] = await roundtrip(handle, [rpc(1, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "0" } })]);
  assert.equal(response.id, 1);
  assert.equal(response.result.protocolVersion, "2025-03-26");
  assert.equal(response.result.serverInfo.name, "evimesh-mcp");
  assert.ok(response.result.capabilities.resources);
  assert.ok(response.result.capabilities.tools);
});

test("initialize falls back to a supported version for unknown requests", async () => {
  const handle = createMcpServer({ client: createFakeClient() });
  const [response] = await roundtrip(handle, [rpc(1, "initialize", { protocolVersion: "1999-01-01" })]);
  assert.equal(response.result.protocolVersion, "2024-11-05");
});

test("rejects malformed and unknown messages", async () => {
  const handle = createMcpServer({ client: createFakeClient() });
  const responses = await roundtrip(handle, [
    { jsonrpc: "2.0", id: 1, method: "no_such_method" },
  ]);
  assert.equal(responses[0].error.code, -32601);

  const { serveStdio } = await import("../src/protocol.mjs");
  const { PassThrough } = await import("node:stream");
  const { createOutputCollector } = await import("./helpers.mjs");
  const input = new PassThrough();
  const output = createOutputCollector();
  const server = serveStdio({ input, output, handle });
  input.write("not json at all\n");
  input.write(JSON.stringify({ id: 9, method: "ping" }) + "\n");
  await new Promise((resolve) => setImmediate(resolve));
  input.end();
  await new Promise((resolve) => setImmediate(resolve));
  server.close();
  const errors = output.responses();
  assert.equal(errors[0].error.code, -32700);
  assert.equal(errors[1].error.code, -32600);
});

test("ping and notifications behave correctly", async () => {
  const handle = createMcpServer({ client: createFakeClient() });
  const responses = await roundtrip(handle, [
    { jsonrpc: "2.0", method: "notifications/initialized" },
    rpc(2, "ping"),
  ]);
  assert.equal(responses.length, 1);
  assert.equal(responses[0].id, 2);
  assert.deepEqual(responses[0].result, {});
});

test("lists static resources and templates", async () => {
  const handle = createMcpServer({ client: createFakeClient() });
  const [response] = await roundtrip(handle, [rpc(1, "resources/list")]);
  const uris = response.result.resources.map((resource) => resource.uri);
  assert.deepEqual(uris, ["evimesh://projects", "evimesh://questions/open", "evimesh://tasks/open"]);
  const templates = response.result.resourceTemplates.map((template) => template.uriTemplate);
  assert.ok(templates.includes("evimesh://tasks/{taskId}/context/{mode}"));
  assert.ok(templates.includes("evimesh://claims/{claimId}/revisions/{revision}"));
  assert.ok(templates.includes("evimesh://projects/{projectId}/frontier/latest"));
  assert.ok(templates.includes("evimesh://projects/{projectId}/frontier/sequence/{sequence}"));
  assert.ok(templates.includes("evimesh://actors/{actorId}/contributions"));
});

test("reads each resource type", async () => {
  const handle = createMcpServer({ client: createFakeClient() });
  const read = async (uri) => {
    const [response] = await roundtrip(handle, [rpc(1, "resources/read", { uri })]);
    assert.equal(response.error, undefined, `${uri}: ${JSON.stringify(response.error)}`);
    return JSON.parse(response.result.contents[0].text);
  };
  assert.equal((await read("evimesh://projects")).items[0].projectId, "project-1");
  const openQuestions = await read("evimesh://questions/open");
  assert.deepEqual(openQuestions.items.map((question) => question.questionId), ["question-1"]);
  assert.equal((await read("evimesh://tasks/open")).items[0].taskId, "task-1");
  assert.equal((await read("evimesh://tasks/task-9/context/blind")).contextBundleId, "context-task-9");
  assert.equal((await read("evimesh://claims/claim-1/revisions/3")).revision, 3);
  assert.equal((await read("evimesh://projects/project-1/frontier/latest")).snapshotId, "frontier-latest");
  assert.equal((await read("evimesh://projects/project-1/frontier/sequence/1")).snapshotId, "frontier-1");
  assert.equal((await read("evimesh://actors/actor-1/contributions")).actorId, "actor-1");
});

test("rejects invalid resource reads", async () => {
  const handle = createMcpServer({ client: createFakeClient() });
  const badMode = await roundtrip(handle, [rpc(1, "resources/read", { uri: "evimesh://tasks/task-1/context/nonsense" })]);
  assert.ok(badMode[0].error.message.includes("context mode"));
  const badRevision = await roundtrip(handle, [rpc(2, "resources/read", { uri: "evimesh://claims/claim-1/revisions/zero" })]);
  assert.ok(badRevision[0].error.message.includes("positive integer"));
  const missingSequence = await roundtrip(handle, [rpc(3, "resources/read", { uri: "evimesh://projects/project-1/frontier/sequence/99" })]);
  assert.ok(missingSequence[0].error.message.includes("not found"));
  const unknown = await roundtrip(handle, [rpc(4, "resources/read", { uri: "evimesh://bogus" })]);
  assert.ok(unknown[0].error.message.includes("unknown resource"));
});

test("tools/list exposes every research tool with schemas", async () => {
  const handle = createMcpServer({ client: createFakeClient() });
  const [response] = await roundtrip(handle, [rpc(1, "tools/list")]);
  const names = response.result.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    "attach_evidence", "create_claim", "get_task_context", "inspect_provenance",
    "publish_submission", "record_run", "record_trace", "search_open_tasks",
    "start_attempt", "submit_challenge", "submit_verification", "validate_submission",
    "verify_inclusion_proof",
  ]);
  for (const tool of response.result.tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.outputSchema, `${tool.name} needs an outputSchema`);
    assert.ok(tool.description.length > 0);
  }
});

test("tools/call rejects unknown tools with a protocol error", async () => {
  const handle = createMcpServer({ client: createFakeClient() });
  const [response] = await roundtrip(handle, [rpc(1, "tools/call", { name: "nope", arguments: {} })]);
  assert.equal(response.error.code, -32602);
});
