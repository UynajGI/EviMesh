import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, rawHash } from "../../protocol/src/hash.mjs";
import { prepareTypedResearchSubmission } from "../../../apps/api-edge/src/typed-research-prepare.mjs";
import { generateEd25519KeyPair } from "../../signatures/src/ed25519.mjs";
import { verifyEd25519Payload } from "../../signatures/src/server-verification.mjs";
import { keyCreate, keyExportPublic, keyList, keyRevokeLocal } from "../src/commands-setup.mjs";
import { researchSign } from "../src/commands-research.mjs";
import { typedDocToApi } from "../src/documents.mjs";
import { createLocalIdentity, unlockLocalIdentity } from "../src/identity.mjs";
import { createNonce } from "../src/signing.mjs";

const PASSPHRASE = "correct horse battery staple";
const WRONG_PASSPHRASE = "wrong passphrase with length";
const TEST_KDF = Object.freeze({ N: 1024, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const PUBLISHER_ACTOR_ID = "human_publisher_01";
const vaultWorkerPath = fileURLToPath(new URL("./fixtures/vault-worker.mjs", import.meta.url));

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "evimesh-local-signing-"));
  return {
    dir,
    env: { ...process.env, EVIMESH_CONFIG_DIR: dir, HOME: dir, USERPROFILE: dir },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function outputCollector() {
  const emissions = [];
  return { emissions, output: { emit(options, data, human) { emissions.push({ options, data, human: human?.(data) }); } } };
}

function interaction({ secrets = [PASSPHRASE], authorized = true, onAuthorize = null } = {}) {
  let index = 0;
  return {
    __testOnly: true,
    secret: async () => secrets[index++] ?? PASSPHRASE,
    authorize: async (request) => { onAuthorize?.(request); return authorized; },
  };
}

function answerDocument() {
  return {
    schema: "srp.answer.v1",
    answer_id: "answer_018f0f4a-5c00-4000-8000-000000000001",
    project_id: "project_018f0f4a-5c00-4000-8000-000000000001",
    revision: 1,
    supersedes_revision: null,
    state: "draft",
    created_at: "2026-08-31T00:00:00.000Z",
    created_by: "agent_drafter_01",
    title: "A bounded synthesis",
    synthesis: "The evidence supports the stated conclusion.",
    limitations: [],
    question_ref: { kind: "question", id: "question_018f0f4a-5c00-4000-8000-000000000002", revision: 1 },
    additional_inputs: [{ kind: "claim", id: "claim_018f0f4a-5c00-4000-8000-000000000003", revision: 2 }],
  };
}

function writePrepared(dir, patchPrepared = {}, patchArtifact = {}) {
  const document = answerDocument();
  const nonce = "0123456789abcdef";
  const prepared = {
    ...prepareTypedResearchSubmission({
      kind: "answer",
      input: typedDocToApi(document),
      publisherActorId: PUBLISHER_ACTOR_ID,
      nonce,
    }),
    ...patchPrepared,
  };
  const artifact = {
    schema: "srp.prepared-research-submission.v1",
    kind: "answer",
    document,
    binding: {
      schema: "evimesh.prepared-research-binding.v1",
      producerActorId: prepared.payload.producerActorId,
      publisherActorId: PUBLISHER_ACTOR_ID,
      signerActorId: prepared.payload.signerActorId,
      draftedByActorId: prepared.payload.draftedByActorId,
      projectId: prepared.payload.node.projectId,
      revision: prepared.payload.node.revision,
    },
    prepared,
    ...patchArtifact,
  };
  const path = join(dir, "answer.prepared.json");
  writeFileSync(path, JSON.stringify(artifact));
  return { path, artifact };
}

function withTamperedPayload(prepared, mutate) {
  const payload = structuredClone(prepared.payload);
  mutate(payload);
  const signingBytes = canonicalJson({ event_type: prepared.eventType, payload, nonce: prepared.nonce });
  return { ...prepared, payload, signingBytes, signingBytesHash: `sha256:${rawHash(signingBytes)}` };
}

function createTestKey(env) {
  return createLocalIdentity({ env, passphrase: PASSPHRASE, kdfParams: TEST_KDF });
}

function runVaultWorker(request, timeoutMs = 10_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [vaultWorkerPath, JSON.stringify(request)], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => { child.kill(); rejectPromise(new Error("vault worker deadlocked")); }, timeoutMs);
    child.on("error", (error) => { clearTimeout(timer); rejectPromise(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      const text = (code === 0 ? stdout : stderr).trim();
      let payload;
      try { payload = JSON.parse(text); } catch { payload = { ok: false, message: text }; }
      resolvePromise({ code, payload });
    });
  });
}

function readVault(dir) {
  return JSON.parse(readFileSync(join(dir, "signing-keys.json"), "utf8"));
}

function assertVaultClean(dir) {
  assert.equal(existsSync(join(dir, "signing-keys.lock")), false);
  assert.deepEqual(readdirSync(dir).filter((name) => name.endsWith(".tmp") || name.includes(".stale.")), []);
}

test("submission nonces use at least 128 bits of local entropy", () => {
  const first = createNonce();
  const second = createNonce();
  assert.match(first, /^[A-Za-z0-9_-]{16,128}$/);
  assert.notEqual(first, second);
  assert.throws(() => createNonce(new Uint8Array(15)), (error) => error?.code === "CLI_NONCE_INVALID");
});

test("private keys are encrypted at rest and config never retains the legacy plaintext identity", (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const legacy = generateEd25519KeyPair();
  writeFileSync(join(dir, "config.json"), JSON.stringify({
    apiUrl: "https://api.test",
    identity: {
      keyId: "key_legacy",
      algorithm: legacy.algorithm,
      publicKey: legacy.public_key,
      privateKey: legacy.private_key,
      createdAt: "2026-08-30T00:00:00.000Z",
    },
  }));
  const key = createTestKey(env);
  const configText = readFileSync(join(dir, "config.json"), "utf8");
  const vaultText = readFileSync(join(dir, "signing-keys.json"), "utf8");
  assert.equal(configText.includes(legacy.private_key), false);
  assert.equal(vaultText.includes(legacy.private_key), false);
  const vault = JSON.parse(vaultText);
  const compromised = vault.keys.find((entry) => entry.keyId === "key_legacy");
  const active = vault.keys.find((entry) => entry.keyId === key.keyId);
  assert.notEqual(key.keyId, "key_legacy");
  assert.notEqual(key.publicKey, legacy.public_key);
  assert.equal(key.compromisedLegacyKey.keyId, "key_legacy");
  assert.equal(compromised.state, "compromised");
  assert.equal(compromised.compromiseReason, "legacy_plaintext_exposure");
  assert.equal(compromised.privateKey, undefined);
  assert.equal(compromised.encryptedPrivateKey, undefined);
  assert.equal(active.privateKey, undefined);
  assert.equal(active.encryptedPrivateKey.kdf, "scrypt");
  assert.equal(active.encryptedPrivateKey.cipher, "aes-256-gcm");
  const publicDer = Buffer.from(key.publicKey, "base64url");
  assert.equal(key.publicKey.includes("="), false);
  assert.equal(publicDer.length, 44);
  assert.equal(publicDer.subarray(0, 12).toString("hex"), "302a300506032b6570032100");
  assert.equal(publicDer.toString("base64url"), key.publicKey);
  assert.equal(key.fingerprint, `sha256:${createHash("sha256").update(publicDer).digest("hex")}`);
  if (process.platform !== "win32") assert.equal(statSync(join(dir, "signing-keys.json")).mode & 0o077, 0);
});

test("key create and research sign refuse non-interactive execution", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const collected = outputCollector();
  await assert.rejects(
    () => keyCreate({ flags: {}, output: collected.output, env }),
    (error) => error?.code === "CLI_HUMAN_TTY_REQUIRED",
  );
  createTestKey(env);
  const { path } = writePrepared(dir);
  await assert.rejects(
    () => researchSign({ flags: {}, output: collected.output, positionals: [path], env }),
    (error) => error?.code === "CLI_HUMAN_TTY_REQUIRED",
  );
});

test("research sign rejects bypass flags and never accepts an Agent token", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  createTestKey(env);
  const { path } = writePrepared(dir);
  for (const flags of [{ yes: true }, { confirm: "true" }, { token: "agent-token" }, { passphrase: PASSPHRASE }]) {
    await assert.rejects(
      () => researchSign({ flags, output: outputCollector().output, positionals: [path], env, testInteraction: interaction() }),
      (error) => error?.code === "CLI_HUMAN_BYPASS_FORBIDDEN",
    );
  }
});

test("research sign validates server bytes, hash, and document binding before prompting", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  createTestKey(env);
  const neverPrompt = {
    __testOnly: true,
    secret: async () => { throw new Error("must not prompt"); },
    authorize: async () => { throw new Error("must not prompt"); },
  };
  const badHash = writePrepared(dir, { signingBytesHash: `sha256:${"0".repeat(64)}` }).path;
  await assert.rejects(
    () => researchSign({ flags: {}, output: outputCollector().output, positionals: [badHash], env, testInteraction: neverPrompt }),
    (error) => error?.code === "CLI_PREPARED_HASH_MISMATCH",
  );
  const canonicalPrepared = writePrepared(dir).artifact.prepared;
  const tamperedPayloads = [
    withTamperedPayload(canonicalPrepared, (payload) => { payload.graphVersion = "research-graph.v999"; }),
    withTamperedPayload(canonicalPrepared, (payload) => { payload.publisherActorId = "human_other_publisher"; }),
    withTamperedPayload(canonicalPrepared, (payload) => { payload.draftedByActorId = "agent_other_drafter"; }),
    withTamperedPayload(canonicalPrepared, (payload) => { payload.incomingEdges = payload.incomingEdges.slice(1); }),
    withTamperedPayload(canonicalPrepared, (payload) => { payload.unexpected = "must fail closed"; }),
    withTamperedPayload(canonicalPrepared, (payload) => { payload.node.unexpected = "must also fail closed"; }),
  ];
  for (const [index, prepared] of tamperedPayloads.entries()) {
    const tampered = writePrepared(dir, prepared).path;
    await assert.rejects(
      () => researchSign({ flags: {}, output: outputCollector().output, positionals: [tampered], env, testInteraction: neverPrompt }),
      (error) => error?.code === "CLI_PREPARED_DOCUMENT_MISMATCH",
      `tampered prepared payload case ${index}`,
    );
  }
  const mismatched = writePrepared(dir, {}, { document: { ...answerDocument(), title: "Swapped after prepare" } }).path;
  await assert.rejects(
    () => researchSign({ flags: {}, output: outputCollector().output, positionals: [mismatched], env, testInteraction: neverPrompt }),
    (error) => error?.code === "CLI_PREPARED_DOCUMENT_MISMATCH",
  );
});

test("research sign cancellation and wrong passphrase fail without writing a signed artifact", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  createTestKey(env);
  const { path } = writePrepared(dir);
  const out = join(dir, "answer.signed.json");
  await assert.rejects(
    () => researchSign({ flags: { out }, output: outputCollector().output, positionals: [path], env, testInteraction: interaction({ authorized: false }) }),
    (error) => error?.code === "CLI_HUMAN_CANCELLED",
  );
  assert.equal(existsSync(out), false);
  await assert.rejects(
    () => researchSign({ flags: { out }, output: outputCollector().output, positionals: [path], env, testInteraction: interaction({ secrets: [WRONG_PASSPHRASE] }) }),
    (error) => error?.code === "CLI_KEY_UNLOCK_FAILED" && !error.message.includes(PASSPHRASE),
  );
  assert.equal(existsSync(out), false);
});

test("research sign produces an envelope verifiable by the protocol and never emits private material", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const key = createTestKey(env);
  const { path, artifact } = writePrepared(dir);
  const out = join(dir, "answer.signed.json");
  const collected = outputCollector();
  let authorizationRequest = null;
  assert.equal(await researchSign({
    flags: { out, json: true },
    output: collected.output,
    positionals: [path],
    env,
    testInteraction: interaction({ onAuthorize: (request) => { authorizationRequest = request; } }),
  }), 0);
  const signed = JSON.parse(readFileSync(out, "utf8"));
  const envelope = signed.signatureEnvelope;
  assert.equal(envelope.signature.key_id, key.keyId);
  assert.equal(await verifyEd25519Payload({
    signingBytes: new TextEncoder().encode(artifact.prepared.signingBytes),
    signature: envelope.signature.value,
    publicKey: key.publicKey,
  }), true);
  assert.match(authorizationRequest.prompt, /project: project_018f0f4a-5c00-4000-8000-000000000001/);
  assert.match(authorizationRequest.prompt, /revision: 1/);
  assert.match(authorizationRequest.prompt, /human publisher\/signing actor: human_publisher_01/);
  assert.match(authorizationRequest.prompt, /drafted by: agent_drafter_01/);
  assert.match(authorizationRequest.prompt, /title: A bounded synthesis/);
  assert.match(authorizationRequest.prompt, /synthesis: The evidence supports the stated conclusion\./);
  assert.match(authorizationRequest.prompt, /incoming edges \(2\):/);
  assert.match(authorizationRequest.prompt, /answers question:question_018f0f4a-5c00-4000-8000-000000000002@1/);
  assert.match(authorizationRequest.prompt, /derived_from claim:claim_018f0f4a-5c00-4000-8000-000000000003@2/);
  assert.equal(authorizationRequest.phrase, `SIGN ${artifact.prepared.signingBytesHash.slice("sha256:".length, "sha256:".length + 12)}`);
  const emitted = JSON.stringify(collected.emissions);
  assert.equal(/privateKey|encryptedPrivateKey|ciphertext|passphrase/i.test(emitted), false);
  assert.equal(/privateKey|encryptedPrivateKey|ciphertext|passphrase/i.test(readFileSync(out, "utf8")), false);
});

test("public-key commands expose only public metadata and local disablement removes this encrypted copy", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const createOutput = outputCollector();
  assert.equal(await keyCreate({
    flags: { label: "Laptop key" },
    output: createOutput.output,
    env,
    testInteraction: interaction({ secrets: [PASSPHRASE, PASSPHRASE] }),
    testKeyStoreOptions: { kdfParams: TEST_KDF },
  }), 0);
  const keyId = createOutput.emissions[0].data.key.keyId;
  const listOutput = outputCollector();
  await keyList({ flags: { json: true }, output: listOutput.output, env });
  const exportPath = join(dir, "public-key.json");
  const exportOutput = outputCollector();
  await keyExportPublic({ flags: { key: keyId, out: exportPath }, output: exportOutput.output, env });
  for (const value of [JSON.stringify(listOutput.emissions), JSON.stringify(exportOutput.emissions), readFileSync(exportPath, "utf8")]) {
    assert.equal(/privateKey|encryptedPrivateKey|ciphertext|passphrase/i.test(value), false);
    assert.match(value, /publicKey/);
  }
  const disableOutput = outputCollector();
  await keyRevokeLocal({
    flags: {}, output: disableOutput.output, env, positionals: [keyId], testInteraction: interaction(),
  });
  const vault = JSON.parse(readFileSync(join(dir, "signing-keys.json"), "utf8"));
  assert.equal(vault.keys[0].state, "disabled-local");
  assert.equal(vault.keys[0].encryptedPrivateKey, undefined);
  assert.match(disableOutput.emissions[0].human, /revoke the registered public key separately/);
  assert.doesNotMatch(disableOutput.emissions[0].human, /cannot be undone|revoked local key/i);
  assert.throws(() => unlockLocalIdentity({ keyId, passphrase: PASSPHRASE, env }), (error) => error?.code === "CLI_KEY_NOT_FOUND");
});

test("vault serializes concurrent create/create mutations with generation CAS", async (t) => {
  const { dir, cleanup } = setup();
  t.after(cleanup);
  const [first, second] = await Promise.all([
    runVaultWorker({ action: "create", dir, passphrase: PASSPHRASE, label: "First" }),
    runVaultWorker({ action: "create", dir, passphrase: PASSPHRASE, label: "Second" }),
  ]);
  assert.equal(first.code, 0, JSON.stringify(first.payload));
  assert.equal(second.code, 0, JSON.stringify(second.payload));
  const vault = readVault(dir);
  assert.equal(vault.generation, 2);
  assert.equal(vault.keys.length, 2);
  assert.equal(new Set(vault.keys.map((key) => key.keyId)).size, 2);
  assert.deepEqual(vault.keys.map((key) => key.state).sort(), ["active", "active"]);
  assertVaultClean(dir);
});

test("vault serializes concurrent create/revoke mutations without losing either update", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const existing = createTestKey(env);
  const [created, removed] = await Promise.all([
    runVaultWorker({ action: "create", dir, passphrase: PASSPHRASE, label: "Replacement" }),
    runVaultWorker({ action: "revoke", dir, keyId: existing.keyId }),
  ]);
  assert.equal(created.code, 0, JSON.stringify(created.payload));
  assert.equal(removed.code, 0, JSON.stringify(removed.payload));
  const vault = readVault(dir);
  assert.equal(vault.generation, 3);
  assert.equal(vault.keys.length, 2);
  const disabled = vault.keys.find((key) => key.keyId === existing.keyId);
  assert.equal(disabled.state, "disabled-local");
  assert.equal(disabled.encryptedPrivateKey, undefined);
  assert.equal(vault.keys.filter((key) => key.state === "active").length, 1);
  assertVaultClean(dir);
});

test("vault serializes concurrent revoke/revoke mutations and fails the loser closed", async (t) => {
  const { dir, env, cleanup } = setup();
  t.after(cleanup);
  const existing = createTestKey(env);
  const results = await Promise.all([
    runVaultWorker({ action: "revoke", dir, keyId: existing.keyId }),
    runVaultWorker({ action: "revoke", dir, keyId: existing.keyId }),
  ]);
  assert.deepEqual(results.map((result) => result.code).sort(), [0, 2]);
  assert.equal(results.find((result) => result.code === 2).payload.code, "CLI_KEY_NOT_FOUND");
  const vault = readVault(dir);
  assert.equal(vault.generation, 2);
  assert.equal(vault.keys[0].state, "disabled-local");
  assert.equal(vault.keys[0].encryptedPrivateKey, undefined);
  assertVaultClean(dir);
});

test("vault recovers a crashed stale lock without deadlocking", async (t) => {
  const { dir, cleanup } = setup();
  t.after(cleanup);
  const lock = join(dir, "signing-keys.lock");
  mkdirSync(lock);
  writeFileSync(join(lock, "owner.json"), JSON.stringify({
    token: "abandoned",
    pid: 2_147_483_647,
    host: hostname(),
    createdAt: "2000-01-01T00:00:00.000Z",
  }));
  const result = await runVaultWorker({ action: "create", dir, passphrase: PASSPHRASE, label: "Recovered" });
  assert.equal(result.code, 0, JSON.stringify(result.payload));
  assert.equal(readVault(dir).generation, 1);
  assertVaultClean(dir);
});
