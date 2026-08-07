import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
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

/** Start an Attempt: create a local workspace and register the remote Attempt. */
export async function attemptStart({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const taskId = requirePositional(positionals, 0, "taskId");
  const mode = flagString(flags, "mode", "frontier");
  const bundle = await client.tasks.context(taskId, mode);
  const attemptId = flagString(flags, "attempt-id", `attempt_${randomUUID()}`);
  const started = await client.attempts.start(taskId, {
    attemptId,
    contextBundleId: bundle.contextBundleId,
    contextMode: mode,
  });
  const workspace = resolve(flagString(flags, "workspace", join(".evimesh", "attempts", attemptId)));
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, "attempt.json"), `${JSON.stringify({ attempt: started.attempt ?? started, contextBundle: bundle, workspace }, null, 2)}\n`, "utf8");
  const result = { attemptId, taskId, contextBundleId: bundle.contextBundleId, contextMode: mode, workspace };
  output.emit({ json: flagBool(flags, "json") }, result, (data) =>
    `started attempt ${data.attemptId} for ${data.taskId}\ncontext: ${data.contextBundleId} (${data.contextMode})\nworkspace: ${data.workspace}`);
  return 0;
}
