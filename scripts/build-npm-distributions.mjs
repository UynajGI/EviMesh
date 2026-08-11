import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaSource = resolve(repoRoot, "packages/schemas");

const targets = Object.freeze({
  cli: {
    entry: resolve(repoRoot, "packages/cli/bin/sq.mjs"),
    output: resolve(repoRoot, "packages/cli/dist/sq.mjs"),
  },
  mcp: {
    entry: resolve(repoRoot, "apps/mcp/bin/evimesh-mcp.mjs"),
    output: resolve(repoRoot, "apps/mcp/dist/evimesh-mcp.mjs"),
  },
});

const requested = process.argv.slice(2);
const names = requested.length === 0 ? Object.keys(targets) : requested;
for (const name of names) {
  if (!(name in targets)) throw new Error(`unknown npm distribution target: ${name}`);
}

for (const name of names) {
  const target = targets[name];
  const distDir = dirname(target.output);
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  await build({
    entryPoints: [target.entry],
    outfile: target.output,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    logLevel: "info",
  });
  if (!existsSync(target.output)) throw new Error(`build did not produce ${target.output}`);
  cpSync(schemaSource, resolve(distDir, "schemas"), {
    recursive: true,
    filter: (source) => source === schemaSource || source.endsWith(".schema.json"),
  });
}
