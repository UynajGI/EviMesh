import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildClient } from "./client.mjs";
import { flagBool, flagString, requirePositional } from "./args.mjs";
import { readDocument, typedDocToApi, typedDocumentDefinition, typedResearchTemplate, typedSubmissionRoute, validateDocument } from "./documents.mjs";
import { createNonce, signSubmission } from "./signing.mjs";
import { createObjectId } from "../../protocol/src/uuidv7.mjs";

const OBJECT_KIND = Object.freeze({ answer: "Answer", rebuttal: "Rebuttal", evaluation: "Evaluation", dataset: "Dataset", tool: "Tool" });

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function writeJson(path, value) {
  ensureParent(path);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function defaultDerivedPath(inputPath, suffix) {
  return resolve(`${String(inputPath).replace(/\.json$/i, "")}.${suffix}.json`);
}

export async function researchDraft({ flags, output, positionals }) {
  const kind = requirePositional(positionals, 0, "kind").toLowerCase();
  if (!OBJECT_KIND[kind]) throw new Error(`unsupported research kind: ${kind}`);
  const id = flagString(flags, "id", createObjectId(OBJECT_KIND[kind]));
  const out = resolve(flagString(flags, "out", `.evimesh/drafts/${id}.${kind}.json`));
  const document = typedResearchTemplate({
    kind,
    id,
    projectId: flagString(flags, "project", flagString(flags, "project-id", "project_TODO")),
    createdBy: flagString(flags, "created-by", "TODO: drafting actor id"),
  });
  writeJson(out, document);
  output.emit({ json: flagBool(flags, "json") }, { kind, id, out, document }, (data) => `${data.kind} draft written to ${data.out}\nnext: edit it, validate it, then run \`sq research prepare ${data.out}\``);
  return 0;
}

export async function researchPrepare({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const path = resolve(requirePositional(positionals, 0, "document"));
  const document = readDocument(path);
  validateDocument(document);
  const route = typedSubmissionRoute(document);
  if (!route) throw new Error(`research prepare does not support ${document.schema}`);
  const body = { ...typedDocToApi(document), nonce: flagString(flags, "nonce", createNonce()) };
  const prepared = await client[`${route.kind}s`].prepare(body);
  const artifact = { schema: "srp.prepared-research-submission.v1", kind: route.kind, document, prepared };
  const out = resolve(flagString(flags, "out", defaultDerivedPath(path, "prepared")));
  writeJson(out, artifact);
  output.emit({ json: flagBool(flags, "json") }, { out, ...artifact }, (data) => `prepared canonical ${data.kind} signing payload at ${data.out}\nnext: review it, then run \`sq research sign ${data.out}\``);
  return 0;
}

export async function researchSign({ flags, output, positionals, env = process.env }) {
  const path = resolve(requirePositional(positionals, 0, "prepared-document"));
  const artifact = readDocument(path);
  if (artifact?.schema !== "srp.prepared-research-submission.v1" || !artifact.prepared || !typedDocumentDefinition(artifact.document)) throw new Error("expected a prepared typed research submission");
  const { eventType, payload, nonce } = artifact.prepared;
  const signed = await signSubmission({ eventType, payload, nonce }, { env });
  if (artifact.prepared.signingBytesHash && artifact.prepared.signingBytesHash !== signed.signingBytesHash) throw new Error("prepared signing bytes hash does not match the canonical payload");
  const signatureEnvelope = {
    schema: "srp.client-signature-envelope.v1",
    event_type: eventType,
    payload,
    nonce,
    signing_bytes_hash: signed.signingBytesHash,
    signature: signed.signature,
  };
  const result = { schema: "srp.signed-research-submission.v1", kind: artifact.kind, document: artifact.document, signatureEnvelope };
  const out = resolve(flagString(flags, "out", defaultDerivedPath(path, "signed")));
  writeJson(out, result);
  output.emit({ json: flagBool(flags, "json") }, { out, ...result }, (data) => `human signature written to ${data.out}\nnext: run \`sq research submit ${data.out}\``);
  return 0;
}

export async function researchSubmit({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const path = resolve(requirePositional(positionals, 0, "signed-document"));
  const artifact = readDocument(path);
  if (artifact?.schema !== "srp.signed-research-submission.v1" || !artifact.signatureEnvelope || !typedDocumentDefinition(artifact.document)) throw new Error("expected an externally signed typed research submission");
  validateDocument(artifact.document);
  const route = typedSubmissionRoute(artifact.document);
  const body = { ...typedDocToApi(artifact.document), signatureEnvelope: artifact.signatureEnvelope };
  if (flagBool(flags, "dry-run")) {
    output.emit({ json: flagBool(flags, "json") }, { dryRun: true, route: route.path, body }, (data) => `[dry-run] would POST ${data.route} with an existing external signature`);
    return 0;
  }
  const response = await client[`${route.kind}s`].submit(body);
  output.emit({ json: flagBool(flags, "json") }, { submitted: true, route: route.path, signingBytesHash: artifact.signatureEnvelope.signing_bytes_hash, response }, (data) => `submitted externally signed ${route.kind} to ${data.route}\nsigning hash: ${data.signingBytesHash}`);
  return 0;
}
