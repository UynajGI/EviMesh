import { spawnSync } from "node:child_process";

const jsonOutput = process.argv.includes("--json");
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

if (helpRequested) {
  console.log("Usage: pnpm infra:hosted-readiness [--json]");
  console.log("Checks hosted-provider tooling, non-secret configuration, and origin readiness.");
  process.exit(0);
}

if (process.argv.slice(2).some((arg) => arg !== "--json")) {
  console.error("Unknown option. Run with --help for usage.");
  process.exit(2);
}

function commandStatus(name) {
  const result = spawnSync(name, ["--version"], { encoding: "utf8", windowsHide: true });
  if (result.error?.code === "ENOENT") {
    return { name: `${name}-cli`, status: "pending", detail: "CLI not found" };
  }
  return result.status === 0
    ? { name: `${name}-cli`, status: "pass", detail: "installed" }
    : { name: `${name}-cli`, status: "pending", detail: "CLI unavailable" };
}

function envStatus(name, { secret = false } = {}) {
  return process.env[name]
    ? { name, status: "pass", detail: secret ? "configured (value hidden)" : "configured" }
    : { name, status: "pending", detail: secret ? "not configured (value hidden)" : "not configured" };
}

const checks = [
  commandStatus("supabase"),
  commandStatus("wrangler"),
  envStatus("SUPABASE_URL"),
  envStatus("SUPABASE_ACCESS_TOKEN", { secret: true }),
  envStatus("CLOUDFLARE_ACCOUNT_ID"),
  envStatus("CLOUDFLARE_API_TOKEN", { secret: true }),
  envStatus("EVIMESH_WEB_DEV_ORIGIN"),
  envStatus("EVIMESH_WEB_PRODUCTION_ORIGIN"),
  envStatus("EVIMESH_API_PRODUCTION_ORIGIN"),
];

if (jsonOutput) {
  console.log(JSON.stringify({ checks }, null, 2));
} else {
  console.log("EviMesh hosted infrastructure readiness");
  for (const check of checks) {
    console.log(`${check.status.toUpperCase().padEnd(7)} ${check.name.padEnd(32)} ${check.detail}`);
  }
}

process.exit(checks.some(({ status }) => status === "fail") ? 1 : 0);
