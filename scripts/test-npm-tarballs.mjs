import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const probeRoot = mkdtempSync(join(tmpdir(), "evimesh-npm-tarball-"));

function run(command, args, { cwd, input } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    input,
    encoding: "utf8",
    timeout: 30_000,
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

function pack(packageDir, label) {
  const packDir = join(probeRoot, `${label}-pack`);
  mkdirSync(packDir, { recursive: true });
  const output = run(npm, ["pack", "--json", "--pack-destination", packDir], { cwd: packageDir });
  const metadata = JSON.parse(output)[0];
  const files = metadata.files.map((file) => file.path);
  for (const forbidden of [".turbo/turbo-lint.log", "src/main.mjs", "test/cli.test.mjs", "dist/schemas/package.json"]) {
    if (files.includes(forbidden)) throw new Error(`${label} tarball unexpectedly includes ${forbidden}`);
  }
  if (files.some((file) => file.startsWith("src/") || file.startsWith("test/") || file.startsWith(".turbo/"))) {
    throw new Error(`${label} tarball includes development-only source or test files`);
  }
  const tarball = join(packDir, metadata.filename);
  if (!existsSync(tarball)) throw new Error(`${label} tarball was not created`);
  return tarball;
}

function installPackage({ label, tarball }) {
  const directory = join(probeRoot, `${label}-install`);
  mkdirSync(directory, { recursive: true });
  run(npm, ["init", "-y"], { cwd: directory });
  run(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: directory });
  return directory;
}

function runInstalled({ directory, label, command, args, input, expected }) {
  const output = run(npx, ["--no-install", command, ...args], { cwd: directory, input });
  if (!output.includes(expected)) throw new Error(`${label} probe did not contain ${JSON.stringify(expected)}\n${output}`);
}

try {
  const cliTarball = pack(resolve(repoRoot, "packages/cli"), "cli");
  const mcpTarball = pack(resolve(repoRoot, "apps/mcp"), "mcp");
  const cliDirectory = installPackage({ label: "cli", tarball: cliTarball });
  runInstalled({ directory: cliDirectory, label: "cli", command: "sq", args: ["--help"], expected: "EviMesh research network CLI" });
  const documentPath = join(cliDirectory, "claim.json");
  run(npx, ["--no-install", "sq", "claim", "create", "--out", documentPath], { cwd: cliDirectory });
  runInstalled({ directory: cliDirectory, label: "cli schema", command: "sq", args: ["validate", documentPath, "--json"], expected: '"valid": true' });
  const mcpDirectory = installPackage({ label: "mcp", tarball: mcpTarball });
  runInstalled({
    directory: mcpDirectory,
    label: "mcp",
    command: "evimesh-mcp",
    args: [],
    input: `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "tarball-probe", version: "0" } } })}\n`,
    expected: '"name":"evimesh-mcp"',
  });
  process.stdout.write("npm tarball installation probes passed\n");
} finally {
  rmSync(probeRoot, { recursive: true, force: true });
}
