import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildClient } from "./client.mjs";
import { flagString, flagBool, requirePositional } from "./args.mjs";
import { verifyContextBundleHash } from "../../protocol/src/context-bundle-hash.mjs";

/** Pull one Task's ContextBundle, verify its content hash, and persist it locally. */
export async function contextPull({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const taskId = requirePositional(positionals, 0, "taskId");
  const mode = flagString(flags, "mode", "frontier");
  const bundle = await client.tasks.context(taskId, mode);
  let verified = null;
  if (typeof bundle?.contentHash === "string" && bundle.manifest !== undefined) {
    verified = verifyContextBundleHash({ bundle: bundle.manifest, expectedHash: bundle.contentHash });
  }
  const outDir = resolve(flagString(flags, "out", join(".evimesh", "contexts")));
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${bundle?.contextBundleId ?? taskId}-${mode}.json`);
  writeFileSync(outFile, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  const result = { contextBundleId: bundle?.contextBundleId ?? null, mode, contentHash: bundle?.contentHash ?? null, verified: verified?.verified ?? false, outFile };
  output.emit({ json: flagBool(flags, "json") }, result, (data) =>
    `pulled ${data.mode} context ${data.contextBundleId}\nhash ${data.verified ? "verified" : "not verifiable"}: ${data.contentHash}\nwritten to ${data.outFile}`);
  return 0;
}

/** Attempt creation is a formal graph mutation and remains fail-closed. */
export async function attemptStart({ positionals } = {}) {
  requirePositional(positionals, 0, "taskId");
  const error = new Error("sq attempt start is disabled until Attempt exposes prepare -> human-local sign -> external-envelope submit");
  error.code = "CLI_EXTERNAL_SIGNATURE_FLOW_REQUIRED";
  throw error;
}
