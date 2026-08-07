import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/main.mjs";
import { hashContextBundle } from "../../protocol/src/context-bundle-hash.mjs";

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "evimesh-cli-"));
  const env = { ...process.env, EVIMESH_CONFIG_DIR: dir, HOME: dir, USERPROFILE: dir };
  return { dir, env, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name === "content-type" ? "application/json" : null) },
    text: async () => JSON.stringify(body),
  };
}

test("config init writes apiUrl and clientId", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const code = await runCli(["config", "init", "--api-url", "https://api.test", "--json"], { env });
  assert.equal(code, 0);
  const config = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
  assert.equal(config.apiUrl, "https://api.test");
  assert.equal(config.clientId, "evimesh-cli");
});

test("identity generate persists an Ed25519 identity with a did", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init"], { env }), 0);
  assert.equal(await runCli(["identity", "generate", "--json"], { env }), 0);
  const config = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
  assert.ok(config.identity.keyId.startsWith("key_"));
  assert.equal(config.identity.algorithm, "Ed25519");
  assert.ok(config.identity.did.startsWith("did:key:"));
  assert.ok(config.identity.privateKey.length > 0);
});

test("claim create then validate round-trips a template", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init"], { env }), 0);
  const out = join(dir, "draft.claim.json");
  assert.equal(await runCli(["claim", "create", "--out", out, "--question", "question_018f0f4a-5c00-4000-8000-000000000001"], { env }), 0);
  const draft = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(draft.schema, "srp.claim.v1");
  draft.created_by = "actor_01";
  writeFileSync(out, JSON.stringify(draft, null, 2));
  assert.equal(await runCli(["validate", out, "--json"], { env }), 0);
});

test("validate fails for an invalid document and exits non-zero", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const bad = join(dir, "bad.claim.json");
  writeFileSync(bad, JSON.stringify({ schema: "srp.claim.v1", claim_id: "not-a-claim-id" }));
  const code = await runCli(["validate", bad], { env });
  assert.equal(code, 1);
});

test("submit --dry-run signs the canonical payload without network calls", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init"], { env }), 0);
  assert.equal(await runCli(["identity", "generate"], { env }), 0);
  const out = join(dir, "draft.claim.json");
  await runCli(["claim", "create", "--out", out], { env });
  const draft = JSON.parse(readFileSync(out, "utf8"));
  draft.created_by = "actor_01";
  writeFileSync(out, JSON.stringify(draft, null, 2));
  let called = false;
  const code = await runCli(["submit", out, "--dry-run", "--json"], { env, fetchImpl: async () => { called = true; return jsonResponse(200, {}); } });
  assert.equal(code, 0);
  assert.equal(called, false, "dry-run must not hit the network");
});

test("task list renders API results as JSON", async (t) => {
  const { env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init", "--api-url", "https://api.test"], { env }), 0);
  const fetchImpl = async (url) => {
    assert.match(url, /^https:\/\/api\.test\/tasks/);
    return jsonResponse(200, { items: [{ taskId: "task_1", state: "open", type: "compute", tag: "cpu-only" }], nextCursor: null });
  };
  const code = await runCli(["task", "list", "--status", "open", "--json"], { env, fetchImpl });
  assert.equal(code, 0);
});

test("context pull verifies the bundle content hash", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init", "--api-url", "https://api.test"], { env }), 0);
  const manifest = { frontier: { snapshotId: "frontier_1", sequence: 1 }, claims: [] };
  const contentHash = hashContextBundle(manifest);
  const bundle = { contextBundleId: "context_1", taskId: "task_1", mode: "frontier", manifest, contentHash, storageUri: "r2://evimesh/context_1" };
  const fetchImpl = async () => jsonResponse(200, bundle);
  const code = await runCli(["context", "pull", "task_1", "--mode", "frontier", "--out", join(dir, "ctx"), "--json"], { env, fetchImpl });
  assert.equal(code, 0);
});

test("context pull fails when the content hash mismatches", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init", "--api-url", "https://api.test"], { env }), 0);
  const bundle = { contextBundleId: "context_1", taskId: "task_1", mode: "frontier", manifest: { claims: [] }, contentHash: `sha256:${"f".repeat(64)}`, storageUri: "r2://evimesh/context_1" };
  const fetchImpl = async () => jsonResponse(200, bundle);
  const code = await runCli(["context", "pull", "task_1", "--out", join(dir, "ctx")], { env, fetchImpl });
  assert.equal(code, 1);
});

test("unknown command exits with code 2", async (t) => {
  const { env, cleanup } = setup();
  t.after(cleanup);
  const code = await runCli(["definitely", "not", "a", "command"], { env });
  assert.equal(code, 2);
});

test("auth login device flow obtains a limited token from the API", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init", "--api-url", "https://api.test"], { env }), 0);
  const { createApp } = await import("../../../apps/api-edge/src/index.mjs");
  const tokens = [];
  const insertApiToken = async (record) => {
    const persisted = { tokenId: `token-${tokens.length + 1}`, ...record };
    tokens.push(persisted);
    return persisted;
  };
  const repository = {
    findIdentity: async () => ({ actorId: "actor-1" }),
    insertApiToken,
    withTransaction: async (callback) => callback({ insertApiToken }),
  };
  const app = createApp({ repository, authenticate: async () => ({ sub: "supabase-subject" }) });
  let userCode = null;
  const fetchImpl = async (url, options) => {
    const response = await app.fetch(new Request(url, options), {});
    if (String(url).endsWith("/auth/device") && options?.method === "POST") {
      userCode = (await response.clone().json()).user_code;
      queueMicrotask(() => {
        app.fetch(new Request("https://api.test/auth/device/approve", {
          method: "POST",
          headers: { authorization: "Bearer browser-token", "content-type": "application/json" },
          body: JSON.stringify({ user_code: userCode }),
        }), {});
      });
    }
    return response;
  };
  const code = await runCli(["auth", "login", "--json"], { env, fetchImpl });
  assert.equal(code, 0);
  const stored = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"))["evimesh.cli.token"];
  assert.match(stored, /evimesh_/);
  assert.deepEqual(tokens[0].scopes, ["profile:read", "project:read"]);
});

test("submit sends a verifiable signature envelope with the request", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init", "--api-url", "https://api.test"], { env }), 0);
  assert.equal(await runCli(["identity", "generate"], { env }), 0);
  const out = join(dir, "draft.claim.json");
  await runCli(["claim", "create", "--out", out], { env });
  const draft = JSON.parse(readFileSync(out, "utf8"));
  draft.created_by = "actor_01";
  writeFileSync(out, JSON.stringify(draft, null, 2));
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(201, { claim: { claimId: draft.claim_id } });
  };
  const code = await runCli(["submit", out, "--json"], { env, fetchImpl });
  assert.equal(code, 0);
  assert.equal(requests.length, 1);
  const sent = JSON.parse(requests[0].options.body);
  assert.ok(sent.signatureEnvelope, "submission must carry the signature envelope");
  assert.equal(sent.signatureEnvelope.schema, "srp.client-signature-envelope.v1");
  assert.equal(sent.signatureEnvelope.event_type, "claim.created");
  assert.equal(sent.signatureEnvelope.payload.claimId, draft.claim_id);
  const config = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
  const { canonicalJson } = await import("../../protocol/src/hash.mjs");
  const { verifyEd25519Payload } = await import("../../signatures/src/server-verification.mjs");
  const signingBytes = Buffer.from(canonicalJson({
    event_type: sent.signatureEnvelope.event_type,
    payload: sent.signatureEnvelope.payload,
    nonce: sent.signatureEnvelope.nonce,
  }), "utf8");
  const verified = await verifyEd25519Payload({
    signingBytes: new Uint8Array(signingBytes),
    signature: sent.signatureEnvelope.signature.value,
    publicKey: config.identity.publicKey,
  });
  assert.equal(verified, true);
});

test("auth login --token stores only limited scopes", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init"], { env }), 0);
  assert.equal(await runCli(["auth", "login", "--token", "limited-token", "--scopes", "project:read", "--json"], { env }), 0);
  const stored = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"))["evimesh.cli.token"];
  assert.match(stored, /limited-token/);
  const broad = await runCli(["auth", "login", "--token", "broad-token", "--scopes", "admin"], { env });
  assert.equal(broad, 1);
});

test("verify submit --dry-run signs a verification receipt locally", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init"], { env }), 0);
  assert.equal(await runCli(["identity", "generate"], { env }), 0);
  const receipt = {
    schema: "srp.verification-receipt.v1",
    claim_revision_id: "claim_1@2",
    contract_revision_id: "contract_1@1",
    outcome: "supports",
    verification_types: ["reproduction"],
    context_mode: "blind",
    saw_expected_outputs: false,
    implementation_relation: "independent",
    data_relation: "same_input",
    model_family: "none",
    findings: [{ severity: "note", code: "match" }],
  };
  const out = join(dir, "receipt.json");
  writeFileSync(out, JSON.stringify(receipt));
  let called = false;
  const code = await runCli(["verify", "submit", out, "--run-id", "run_1", "--dry-run", "--json"], { env, fetchImpl: async () => { called = true; return jsonResponse(201, {}); } });
  assert.equal(code, 0);
  assert.equal(called, false);
});

test("bundle verify accepts a valid proof set and rejects a tampered one", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const { buildMerkleTree } = await import("../../merkle/src/merkle-tree.mjs");
  const { hashResearchEventLeaf } = await import("../../merkle/src/research-event-leaf.mjs");
  const { createMerkleInclusionProof } = await import("../../merkle/src/inclusion-proof.mjs");
  const events = ["event-1", "event-2"].map((eventId, index) => ({
    schema: "srp.event.v1",
    event_id: eventId,
    event_type: "claim.created",
    payload: { claim_id: "claim-1" },
    hash: `sha256:${String(index).repeat(64)}`,
    signature: { algorithm: "Ed25519", value: "sig" },
    parents: [],
  }));
  const leafHashes = events.map((event) => hashResearchEventLeaf(event));
  const proof = createMerkleInclusionProof({ leafHashes, leafIndex: 0 });
  const good = join(dir, "bundle-good.json");
  writeFileSync(good, JSON.stringify({ proofs: [{ proof }] }));
  assert.equal(await runCli(["bundle", "verify", good, "--json"], { env }), 0);
  const bad = join(dir, "bundle-bad.json");
  writeFileSync(bad, JSON.stringify({ proofs: [{ proof: { ...proof, root: `sha256:${"0".repeat(64)}` } }] }));
  assert.equal(await runCli(["bundle", "verify", bad, "--json"], { env }), 1);
});

test("evidence add --dry-run hashes the file without uploading", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init", "--api-url", "https://api.test"], { env }), 0);
  const file = join(dir, "payload.txt");
  writeFileSync(file, "evidence payload");
  let called = false;
  const code = await runCli(["evidence", "add", file, "--dry-run", "--json"], { env, fetchImpl: async () => { called = true; return jsonResponse(201, {}); } });
  assert.equal(code, 0);
  assert.equal(called, false, "dry-run must not request an upload plan");
});
