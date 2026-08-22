import { PassThrough } from "node:stream";
import { serveStdio } from "../src/protocol.mjs";

/** Collecting writable that records every JSON-RPC line the server emits. */
export function createOutputCollector() {
  const lines = [];
  return {
    lines,
    write(chunk) {
      lines.push(String(chunk).trim());
      return true;
    },
    responses() {
      return lines.filter(Boolean).map((line) => JSON.parse(line));
    },
  };
}

/** Pipe a sequence of JSON-RPC requests through a dispatcher and collect replies. */
export async function roundtrip(handle, requests) {
  const input = new PassThrough();
  const output = createOutputCollector();
  const server = serveStdio({ input, output, handle });
  for (const request of requests) input.write(`${JSON.stringify(request)}\n`);
  // Let readline drain before closing.
  await new Promise((resolve) => setImmediate(resolve));
  input.end();
  await new Promise((resolve) => setImmediate(resolve));
  server.close();
  return output.responses();
}

/** Fake SDK client mirroring the resource/tool surface the server consumes. */
export function createFakeClient(overrides = {}) {
  return {
    projects: { list: async () => ({ items: [{ projectId: "project-1" }], nextCursor: null }) },
    questions: { list: async () => ({ items: [{ questionId: "question-1", state: "active" }, { questionId: "question-2", state: "resolved" }], nextCursor: null }) },
    tasks: {
      list: async (params = {}) => ({ items: [{ taskId: "task-1", status: params.status ?? "open" }], nextCursor: null }),
      context: async (taskId, mode) => ({ contextBundleId: `context-${taskId}`, taskId, mode, contentHash: `sha256:${"a".repeat(64)}`, manifest: {}, storageUri: "r2://evimesh/x" }),
    },
    attempts: {
      start: async (taskId, input) => ({ attempt: { attemptId: input.attemptId, taskId }, contextBundleId: input.contextBundleId }),
      recordTrace: async (attemptId, input) => ({ eventId: input.eventId, attemptId, eventType: input.eventType }),
    },
    claims: { revision: async (claimId, revision) => ({ claimId, revision, statement: "s" }) },
    frontier: {
      latest: async (projectId) => ({ snapshotId: "frontier-latest", projectId, sequence: 2 }),
      history: async () => ({ items: [{ snapshotId: "frontier-1", sequence: 1 }, { snapshotId: "frontier-2", sequence: 2 }], nextCursor: null }),
    },
    contributions: {
      forActor: async (actorId) => ({ actorId, statements: [] }),
      provenance: async (objectType, objectId, revision) => ({ object: { objectType, objectId, revision }, actorEvents: [], frontier: [] }),
    },
    artifacts: {
      uploadPlan: async ({ artifactId }) => ({ key: `artifacts/${artifactId}`, url: "https://r2.example.test/signed", mediaType: "text/plain" }),
      upload: async () => ({ uploaded: true }),
    },
    evidence: { create: async (input) => ({ evidence: input }) },
    verifications: { submit: async (input) => ({ receipt: { receiptId: input.receiptId } }) },
    challenges: { create: async (input) => ({ challenge: { challengeId: input.challengeId } }) },
    http: { request: async (method, path, { body } = {}) => path === "/auth/me" ? { actorId: "agent_01", actorType: "agent" } : { method, path, body } },
    ...overrides,
  };
}
