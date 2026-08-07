import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { buildClient } from "./client.mjs";
import { flagString, flagBool, requirePositional } from "./args.mjs";
import { claimTemplate, runTemplate, readDocument, validateDocument, submissionRoute } from "./documents.mjs";
import { signSubmission, createNonce } from "./signing.mjs";
import { sha256Bytes } from "../../artifact/src/hash.mjs";
import { createObjectId } from "../../protocol/src/uuidv7.mjs";

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

export async function claimCreate({ flags, output }) {
  const claimId = flagString(flags, "claim-id", createObjectId("Claim"));
  const questionId = flagString(flags, "question", flagString(flags, "question-id", null));
  const out = resolve(flagString(flags, "out", `.evimesh/drafts/${claimId}.claim.json`));
  const template = claimTemplate({ claimId, questionId });
  ensureParent(out);
  writeFileSync(out, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  output.emit({ json: flagBool(flags, "json") }, { claimId, out, template }, (data) => `claim template written to ${data.out}\nnext: edit it, then run \`sq validate ${data.out}\``);
  return 0;
}

export async function runRecord({ flags, output, env = process.env }) {
  const runId = flagString(flags, "run-id", createObjectId("Run"));
  const taskId = flagString(flags, "task", flagString(flags, "task-id", "task_TODO"));
  const contextBundleId = flagString(flags, "context-bundle", "context_TODO");
  const out = resolve(flagString(flags, "out", `.evimesh/drafts/${runId}.run.json`));
  const template = runTemplate({ runId, taskId, contextBundleId });
  ensureParent(out);
  writeFileSync(out, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  output.emit({ json: flagBool(flags, "json") }, { runId, out, template }, (data) => `run receipt template written to ${data.out}\nnext: fill it in, then run \`sq validate ${data.out}\``);
  return 0;
}

export async function evidenceAdd({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const file = requirePositional(positionals, 0, "file");
  const bytes = new Uint8Array(readFileSync(file));
  const rawHash = await sha256Bytes(bytes);
  const artifactId = flagString(flags, "artifact-id", `artifact_${randomUUID()}`);
  const revision = Number(flagString(flags, "revision", "1"));
  const mediaType = flagString(flags, "media-type", "application/octet-stream");
  if (flagBool(flags, "dry-run")) {
    output.emit({ json: flagBool(flags, "json") }, { dryRun: true, artifactId, revision, rawHash, sizeBytes: bytes.length, mediaType }, (data) => `[dry-run] would upload ${data.sizeBytes} bytes as ${data.artifactId}@${data.revision}\nhash: ${data.rawHash}`);
    return 0;
  }
  const plan = await client.artifacts.uploadPlan({ artifactId, revision, rawHash, sizeBytes: bytes.length, mediaType });
  await client.artifacts.upload(plan, bytes, { fetchImpl: fetchImpl ?? fetch });
  const result = { artifactId, revision, rawHash, sizeBytes: bytes.length, key: plan.key, uploaded: true };
  output.emit({ json: flagBool(flags, "json") }, result, (data) => `uploaded ${data.sizeBytes} bytes for ${data.artifactId}@${data.revision}\nhash: ${data.rawHash}\nkey: ${data.key}`);
  return 0;
}

export async function validate({ flags, output, positionals }) {
  const path = requirePositional(positionals, 0, "file");
  const document = readDocument(path);
  const { schemaFile } = validateDocument(document);
  output.emit({ json: flagBool(flags, "json") }, { valid: true, schemaFile, path }, (data) => `valid ${data.schemaFile} document: ${data.path}`);
  return 0;
}

export async function submit({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const path = requirePositional(positionals, 0, "file");
  const document = readDocument(path);
  validateDocument(document);
  const route = submissionRoute(document);
  if (!route) throw new Error(`submission is not supported for schema ${document.schema}`);
  const body = route.toApi(document);
  const nonce = createNonce();
  const signed = await signSubmission({ eventType: route.eventType, payload: body, nonce }, { env });
  const envelope = { eventType: route.eventType, payload: body, nonce, signing_bytes_hash: signed.signingBytesHash, signature: signed.signature };
  if (flagBool(flags, "dry-run")) {
    output.emit({ json: flagBool(flags, "json") }, { dryRun: true, route: route.path, envelope }, (data) => `[dry-run] would POST ${data.route}\n${JSON.stringify(data.envelope, null, 2)}`);
    return 0;
  }
  const response = await client.http.request(route.method, route.path, { body });
  output.emit({ json: flagBool(flags, "json") }, { submitted: true, route: route.path, envelope, response }, (data) => `submitted to ${data.route}\nsigning hash: ${data.envelope.signing_bytes_hash}`);
  return 0;
}

export async function challengeCreate({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const path = requirePositional(positionals, 0, "file");
  const document = readDocument(path);
  validateDocument(document);
  if (document.schema !== "srp.challenge.v1") throw new Error(`expected srp.challenge.v1, got ${document.schema}`);
  const { challengeDocToApi } = await import("./documents.mjs");
  const body = challengeDocToApi(document);
  if (flagBool(flags, "dry-run")) {
    output.emit({ json: flagBool(flags, "json") }, { dryRun: true, route: "/challenges", body }, (data) => `[dry-run] would POST ${data.route}\n${JSON.stringify(data.body, null, 2)}`);
    return 0;
  }
  const response = await client.challenges.create(body);
  output.emit({ json: flagBool(flags, "json") }, { submitted: true, response }, () => `challenge ${body.challengeId} submitted`);
  return 0;
}
