import { spawnSync } from "node:child_process";

const SERVICES = ["postgres", "minio", "mailpit"];
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: pnpm infra:up");
  console.log("Starts the local PostgreSQL, MinIO, and Mailpit Compose services.");
  process.exit(0);
}

if (args.length > 0) {
  console.error(`Unknown option: ${args[0]}`);
  console.error("Run with --help for usage.");
  process.exit(2);
}

console.log(`Starting local infrastructure: ${SERVICES.join(", ")}`);
const result = spawnSync(
  "docker",
  ["compose", "up", "-d", ...SERVICES],
  { stdio: "inherit" },
);

if (result.error?.code === "ENOENT") {
  console.error("Docker CLI was not found. Install Docker Desktop and retry.");
  process.exit(127);
}

if (result.error) {
  console.error(`Could not start Docker Compose: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Local infrastructure started.");
