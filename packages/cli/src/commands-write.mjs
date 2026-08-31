import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { flagString, flagBool, requirePositional } from "./args.mjs";
import { claimTemplate, runTemplate, readDocument, validateDocument, assertCanonicalRunDocument, submissionRoute } from "./documents.mjs";
import { sha256Bytes } from "../../artifact/src/hash.mjs";
import { createObjectId } from "../../protocol/src/uuidv7.mjs";

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function externalSignatureMigrationError(command) {
  const error = new Error(`${command} no longer signs and submits in one step; use draft -> prepare -> the explicit human-local sign step -> submit with an existing envelope`);
  error.code = "CLI_EXTERNAL_SIGNATURE_FLOW_REQUIRED";
  return error;
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

export async function evidenceAdd({ flags, output, positionals } = {}) {
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
  throw externalSignatureMigrationError("sq evidence add");
}

export async function validate({ flags, output, positionals }) {
  const path = requirePositional(positionals, 0, "file");
  const document = readDocument(path);
  const { schemaFile } = validateDocument(document);
  output.emit({ json: flagBool(flags, "json") }, { valid: true, schemaFile, path }, (data) => `valid ${data.schemaFile} document: ${data.path}`);
  return 0;
}

export async function submit({ positionals } = {}) {
  const path = requirePositional(positionals, 0, "file");
  const document = readDocument(path);
  validateDocument(document);
  if (document.schema === "srp.run.v1") assertCanonicalRunDocument(document);
  const route = submissionRoute(document);
  if (!route) throw new Error(`submission is not supported for schema ${document.schema}`);
  throw externalSignatureMigrationError("sq submit");
}

export async function challengeCreate({ positionals } = {}) {
  const path = requirePositional(positionals, 0, "file");
  const document = readDocument(path);
  validateDocument(document);
  if (document.schema !== "srp.challenge.v1") throw new Error(`expected srp.challenge.v1, got ${document.schema}`);
  throw externalSignatureMigrationError("sq challenge create");
}
