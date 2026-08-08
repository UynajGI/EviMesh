import test from "node:test";
import assert from "node:assert/strict";
import { createGitHubMirrorClient, MirrorError } from "../src/github-release.mjs";
import { recordMirrorReceipt, mirrorFrontierBundle, createMirrorAdapterRegistry } from "../src/mirror.mjs";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

test("GitHub client creates releases and uploads assets", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/releases")) return jsonResponse(201, { id: 42, html_url: "https://github.com/o/r/releases/tag/x" });
    return jsonResponse(201, { id: 7, browser_download_url: "https://github.com/o/r/releases/download/x/bundle.zip" });
  };
  const client = createGitHubMirrorClient({ token: "token", owner: "o", repo: "r", fetchImpl });
  const release = await client.createRelease({ tag: "frontier/p/1", name: "Frontier p #1" });
  assert.equal(release.releaseId, 42);
  const asset = await client.uploadAsset({ releaseId: 42, fileName: "bundle.zip", bytes: new Uint8Array([1, 2, 3]) });
  assert.equal(asset.assetId, 7);
  assert.match(asset.sha256, /^[0-9a-f]{64}$/);
  assert.equal(calls[0].options.headers.authorization, "Bearer token");
  assert.match(calls[1].url, /uploads\.github\.com.*releases\/42\/assets/);
});

test("GitHub client requires a token and surfaces API errors", async () => {
  assert.throws(() => createGitHubMirrorClient({ owner: "o", repo: "r" }), MirrorError);
  const client = createGitHubMirrorClient({ token: "t", owner: "o", repo: "r", fetchImpl: async () => jsonResponse(500, {}) });
  await assert.rejects(client.createRelease({ tag: "x", name: "x" }), (error) => error.code === "MIRROR_API_ERROR");
});

test("mirrorFrontierBundle stores a receipt with release URL and asset hash", async () => {
  const receipts = [];
  const repository = { insertMirrorReceipt: async (receipt) => { receipts.push(receipt); return receipt; } };
  const client = {
    createRelease: async () => ({ releaseId: 1, url: "https://github.com/o/r/releases/tag/t" }),
    uploadAsset: async () => ({ url: "https://github.com/o/r/asset.zip", sha256: `${"b".repeat(64)}`, sizeBytes: 9 }),
  };
  const result = await mirrorFrontierBundle({
    client,
    repository,
    snapshot: { snapshotId: "frontier_1", projectId: "project_1", sequence: 1 },
    zipBytes: new Uint8Array(9),
    fileName: "frontier_1.zip",
  });
  assert.equal(result.mirrored, true);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].frontierSnapshotId, "frontier_1");
  assert.equal(receipts[0].assetSha256, `${"b".repeat(64)}`);
  assert.equal(receipts[0].provider, "github-release");
});

test("mirror failures are queued for Outbox retry instead of throwing", async () => {
  const queued = [];
  const repository = { insertMirrorReceipt: async () => { throw new Error("must not store receipt on failure"); } };
  const client = { createRelease: async () => { throw new Error("boom"); }, uploadAsset: async () => ({}) };
  const result = await mirrorFrontierBundle({
    client,
    repository,
    snapshot: { snapshotId: "frontier_1", projectId: "project_1", sequence: 1 },
    zipBytes: new Uint8Array(1),
    fileName: "frontier_1.zip",
    enqueueRetry: async (job) => { queued.push(job); },
  });
  assert.equal(result.mirrored, false);
  assert.equal(result.queuedForRetry, true);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].jobType, "mirror.frontier-release");
  assert.equal(queued[0].payload.frontierSnapshotId, "frontier_1");
});

test("mirror failures throw when no retry queue is available", async () => {
  const client = { createRelease: async () => { throw new Error("boom"); }, uploadAsset: async () => ({}) };
  await assert.rejects(mirrorFrontierBundle({
    client,
    repository: {},
    snapshot: { snapshotId: "frontier_1", projectId: "p", sequence: 1 },
    zipBytes: new Uint8Array(1),
    fileName: "f.zip",
  }), /boom/);
});

test("secondary mirror adapters can be registered and published to", async () => {
  const registry = createMirrorAdapterRegistry();
  const published = [];
  registry.register({ name: "secondary", publish: async (input) => { published.push(input); return { ok: true }; } });
  registry.register({ name: "broken", publish: async () => { throw new Error("nope"); } });
  assert.deepEqual(registry.names().sort(), ["broken", "secondary"]);
  assert.throws(() => registry.register({ name: "secondary", publish: async () => {} }), /already registered/);
  const results = await registry.publishAll({ snapshot: { snapshotId: "s" }, zipBytes: new Uint8Array(1), fileName: "f.zip" });
  assert.equal(results.length, 2);
  assert.equal(results.find((r) => r.name === "secondary").ok, true);
  assert.equal(results.find((r) => r.name === "broken").ok, false);
  assert.equal(published.length, 1);
});

test("recordMirrorReceipt validates its inputs", async () => {
  const repository = { insertMirrorReceipt: async (receipt) => receipt };
  await assert.rejects(recordMirrorReceipt({ repository, frontierSnapshotId: "", releaseUrl: "u", assetSha256: `${"c".repeat(64)}` }), /frontierSnapshotId/);
  await assert.rejects(recordMirrorReceipt({ repository, frontierSnapshotId: "s", releaseUrl: "u", assetSha256: "nothex" }), /sha256/);
});
