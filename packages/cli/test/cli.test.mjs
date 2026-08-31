import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../src/main.mjs";
import { submit as submitCommand } from "../src/commands-write.mjs";
import { canonicalRunDocument } from "../src/documents.mjs";
import { hashContextBundle } from "../../protocol/src/context-bundle-hash.mjs";
import { canonicalJson, rawHash } from "../../protocol/src/hash.mjs";

const validRunFixturePath = fileURLToPath(new URL("../../schemas/fixtures/valid/run.json", import.meta.url));

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

test("rejects Run receipts without a signing key while templates remain key-qualified", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);

  const legacyRun = JSON.parse(readFileSync(validRunFixturePath, "utf8"));
  delete legacyRun.signing_key_id;
  const legacyPath = join(dir, "legacy.run.json");
  writeFileSync(legacyPath, JSON.stringify(legacyRun));
  assert.equal(await runCli(["validate", legacyPath, "--json"], { env }), 1);

  const templatePath = join(dir, "new.run.json");
  assert.equal(await runCli(["run", "record", "--out", templatePath], { env }), 0);
  const template = JSON.parse(readFileSync(templatePath, "utf8"));
  assert.equal(template.signing_key_id, "TODO: signing key id");
});

test("legacy submit --dry-run fails closed instead of loading the human signer", async (t) => {
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
  assert.equal(code, 1);
  assert.equal(called, false, "dry-run must not hit the network");
});

test("submit rejects schema-valid noncanonical Runs before signing or network access", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init"], { env }), 0);
  const schemaValidRun = JSON.parse(readFileSync(validRunFixturePath, "utf8"));
  const canonicalRun = canonicalRunDocument(schemaValidRun);
  const cases = [
    { name: "missing-revision", document: schemaValidRun, code: "RUN_DOCUMENT_NONCANONICAL" },
    { name: "offset-timestamp", document: { ...canonicalRun, started_at: "2026-08-04T14:00:00+08:00" }, code: "RUN_DOCUMENT_NONCANONICAL" },
    { name: "text-whitespace", document: { ...canonicalRun, source_code: " git:0123456789abcdef" }, code: "RUN_TEXT_INVALID" },
    { name: "duplicate-input", document: { ...canonicalRun, input_artifact_ids: [canonicalRun.input_artifact_ids[0], canonicalRun.input_artifact_ids[0]] }, code: "CLI_DOCUMENT_VALIDATION" },
  ];
  let fetchCalls = 0;
  const fetchImpl = async () => { fetchCalls += 1; return jsonResponse(201, {}); };
  for (const { name, document, code } of cases) {
    const path = join(dir, `${name}.run.json`);
    writeFileSync(path, JSON.stringify(document));
    for (const dryRun of [false, true]) {
      await assert.rejects(
        () => submitCommand({
          flags: dryRun ? { "dry-run": true } : {}, output: { emit() {} }, positionals: [path], env, fetchImpl,
        }),
        (error) => error?.code === code,
        `${name} (${dryRun ? "dry-run" : "submit"})`,
      );
    }
  }
  assert.equal(fetchCalls, 0);
});

test("legacy submit rejects an already-canonical Run until an external-envelope flow is used", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init", "--api-url", "https://api.test"], { env }), 0);
  assert.equal(await runCli(["identity", "generate", "--json"], { env }), 0);
  const document = canonicalRunDocument(JSON.parse(readFileSync(validRunFixturePath, "utf8")));
  const path = join(dir, "canonical.run.json");
  writeFileSync(path, JSON.stringify(document));
  const requests = [];
  const fetchImpl = async (url, options) => { requests.push({ url, options }); return jsonResponse(201, { run: { runId: document.run_id } }); };

  await assert.rejects(
    () => submitCommand({ flags: {}, output: { emit() {} }, positionals: [path], env, fetchImpl }),
    (error) => error?.code === "CLI_EXTERNAL_SIGNATURE_FLOW_REQUIRED",
  );
  assert.equal(requests.length, 0);
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

test("graph inspect requests the same typed neighborhood used by the web UI", async (t) => {
  const { env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init", "--api-url", "https://api.test"], { env }), 0);
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return jsonResponse(200, {
      schemaVersion: "research-neighborhood.v1",
      requestedRoot: { kind: "question", id: "question-1", revision: 2 },
      resolvedRoot: { kind: "question", id: "question-1", revision: 2 },
      nodes: [{ ref: { kind: "question", id: "question-1", revision: 2 }, label: "Question", state: "published" }],
      edges: [], truncated: false, nextCursor: null,
    });
  };
  const code = await runCli(["graph", "inspect", "question", "question-1", "--revision", "2", "--direction", "both", "--depth", "3", "--kinds", "question,answer", "--edge-types", "answers", "--json"], { env, fetchImpl });
  assert.equal(code, 0);
  assert.equal(calls[0], "https://api.test/research-graph/question/question-1/neighborhood?revision=2&direction=both&depth=3&kinds=question%2Canswer&edgeTypes=answers");
});

test("typed research prepare, human-local sign, and submit remain separate steps", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init", "--api-url", "https://api.test"], { env }), 0);
  assert.equal(await runCli(["identity", "generate", "--json"], { env }), 0);
  const draftPath = join(dir, "answer.json");
  assert.equal(await runCli(["research", "draft", "answer", "--project", "project_018f0f4a-5c00-4000-8000-000000000001", "--created-by", "agent_01", "--out", draftPath], { env }), 0);
  const document = JSON.parse(readFileSync(draftPath, "utf8"));
  document.title = "A bounded synthesis";
  document.synthesis = "The evidence supports the stated conclusion.";
  document.question_ref = { kind: "question", id: "question_018f0f4a-5c00-4000-8000-000000000002", revision: 1 };
  writeFileSync(draftPath, JSON.stringify(document));
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const body = JSON.parse(options.body);
    if (url.endsWith("/answers/prepare")) {
      const { nonce, ...payloadBody } = body;
      const payload = { entityType: "answer", graphVersion: "research-graph.v1", ...payloadBody };
      const signingBytes = canonicalJson({ event_type: "answer.created", payload, nonce });
      return jsonResponse(200, { eventType: "answer.created", payload, nonce, signingBytes, signingBytesHash: `sha256:${rawHash(signingBytes)}` });
    }
    return jsonResponse(201, { node: { nodeId: document.answer_id, nodeKind: "answer" } });
  };
  const preparedPath = join(dir, "answer.prepared.json");
  const signedPath = join(dir, "answer.signed.json");
  assert.equal(await runCli(["research", "prepare", draftPath, "--nonce", "0123456789abcdef", "--out", preparedPath, "--json"], { env, fetchImpl }), 0);
  assert.equal(requests.length, 1);
  assert.equal(await runCli(["research", "sign", preparedPath, "--out", signedPath, "--json"], { env }), 0);
  assert.equal(requests.length, 1, "local signing must not call the network");
  const signed = JSON.parse(readFileSync(signedPath, "utf8"));
  assert.equal(signed.signatureEnvelope.signature.algorithm, "Ed25519");
  assert.equal(await runCli(["research", "submit", signedPath, "--json"], { env, fetchImpl }), 0);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, "https://api.test/answers");
  assert.equal(JSON.parse(requests[1].options.body).signatureEnvelope.signature.value, signed.signatureEnvelope.signature.value);
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

test("legacy submit never synthesizes or sends a signature envelope", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  assert.equal(await runCli(["config", "init", "--api-url", "https://api.test"], { env }), 0);
  assert.equal(await runCli(["auth", "login", "--token", "evimesh_test", "--scopes", "profile:read,project:read", "--json"], { env }), 0);
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(201, {});
  };
  assert.equal(await runCli(["identity", "generate", "--json"], { env, fetchImpl }), 0);
  const out = join(dir, "draft.claim.json");
  await runCli(["claim", "create", "--out", out], { env });
  const draft = JSON.parse(readFileSync(out, "utf8"));
  draft.created_by = "actor_01";
  writeFileSync(out, JSON.stringify(draft, null, 2));
  const code = await runCli(["submit", out, "--json"], { env, fetchImpl });
  assert.equal(code, 1);
  assert.ok(requests.some((request) => request.url.endsWith("/signing-keys")), "identity generate must register the signing key");
  const claimRequest = requests.find((request) => request.url.endsWith("/claims"));
  assert.equal(claimRequest, undefined);
});

test("bundle verify binds proofs to the signed checkpoint root", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const { buildMerkleTree } = await import("../../merkle/src/merkle-tree.mjs");
  const { hashResearchEventLeaf } = await import("../../merkle/src/research-event-leaf.mjs");
  const { createMerkleInclusionProof } = await import("../../merkle/src/inclusion-proof.mjs");
  const { signMerkleCheckpoint } = await import("../../signatures/src/merkle-checkpoint.mjs");
  const { generateEd25519KeyPair } = await import("../../signatures/src/ed25519.mjs");
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
  const tree = buildMerkleTree(leafHashes);
  const boundProof = createMerkleInclusionProof({ leafHashes, leafIndex: 0 });
  const platformKey = generateEd25519KeyPair();
  const checkpoint = await signMerkleCheckpoint({
    checkpoint: { schema: "evimesh.merkle-checkpoint.v1", firstEventId: "event-1", lastEventId: "event-2", eventCount: 2, rootHash: tree.root },
    keyId: "platform-key-1",
    privateKey: platformKey.private_key,
  });
  const forgedLeaves = [hashResearchEventLeaf({ ...events[0], event_id: "event-forged" })];
  const forgedProof = createMerkleInclusionProof({ leafHashes: forgedLeaves, leafIndex: 0 });

  const good = join(dir, "bundle-bound.json");
  writeFileSync(good, JSON.stringify({ checkpoint, events, proofs: [{ proof: boundProof }] }));
  assert.equal(await runCli(["bundle", "verify", good, "--platform-key", platformKey.public_key, "--json"], { env }), 0);

  const forged = join(dir, "bundle-forged.json");
  writeFileSync(forged, JSON.stringify({ checkpoint, proofs: [{ proof: forgedProof }] }));
  assert.equal(await runCli(["bundle", "verify", forged, "--platform-key", platformKey.public_key, "--json"], { env }), 1);
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

test("legacy verify submit --dry-run fails closed without signing", async (t) => {
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
  assert.equal(code, 1);
  assert.equal(called, false);
});

test("legacy challenge create fails closed without a network mutation", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const path = join(dir, "challenge.json");
  writeFileSync(path, JSON.stringify({
    schema: "srp.challenge.v1",
    challenge_id: "challenge_018f0f4a-5c00-4000-8000-000000000001",
    revision: 1,
    state: "open",
    target_claim_revision_id: "claim_1@2",
    reason: "A required control is missing.",
    impact: { type: "method", severity: "major", summary: "Missing control" },
    created_at: "2026-08-06T00:00:00.000Z",
    created_by: "agent_01",
  }));
  let called = false;
  const code = await runCli(["challenge", "create", path, "--json"], { env, fetchImpl: async () => { called = true; return jsonResponse(201, {}); } });
  assert.equal(code, 1);
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

test("Attempt and Evidence network mutations fail closed without an external-envelope flow", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const file = join(dir, "payload.txt");
  writeFileSync(file, "evidence payload");
  let called = false;
  const fetchImpl = async () => { called = true; return jsonResponse(201, {}); };
  assert.equal(await runCli(["attempt", "start", "task-1", "--json"], { env, fetchImpl }), 1);
  assert.equal(await runCli(["evidence", "add", file, "--json"], { env, fetchImpl }), 1);
  assert.equal(called, false);
});
