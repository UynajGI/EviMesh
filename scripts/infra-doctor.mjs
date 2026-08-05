import { spawnSync } from "node:child_process";
import { createConnection } from "node:net";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const helpRequested = args.includes("--help") || args.includes("-h");

if (helpRequested) {
  console.log("Usage: pnpm infra:doctor [--json]");
  console.log("Checks local services and configured hosted infrastructure endpoints.");
  process.exit(0);
}

if (args.some((arg) => !["--json"].includes(arg))) {
  console.error("Unknown option. Run with --help for usage.");
  process.exit(2);
}

function checkDocker() {
  const result = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error?.code === "ENOENT") {
    return { name: "docker", status: "fail", detail: "Docker CLI not found" };
  }
  if (result.status !== 0) {
    return { name: "docker", status: "fail", detail: "Docker daemon unavailable" };
  }
  return { name: "docker", status: "pass", detail: result.stdout.trim() || "available" };
}

function checkTcp(name, host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ name, ...result });
    };
    socket.setTimeout(timeoutMs, () => finish({ status: "fail", detail: "connection timeout" }));
    socket.once("connect", () => finish({ status: "pass", detail: `${host}:${port}` }));
    socket.once("error", (error) => finish({ status: "fail", detail: error.code || "connection failed" }));
  });
}

async function checkHttp(name, url, { optional = false, acceptedStatuses = [200, 299] } = {}) {
  if (!url) {
    return { name, status: "pending", detail: "not configured" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return {
      name,
      status: acceptedStatuses.includes(response.status) || response.ok ? "pass" : "fail",
      detail: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      status: optional ? "pending" : "fail",
      detail: error.name === "AbortError" ? "request timeout" : "unreachable",
    };
  } finally {
    clearTimeout(timeout);
  }
}

const docker = checkDocker();
const localChecks = await Promise.all([
  checkTcp("postgres", "127.0.0.1", Number(process.env.EVIMESH_POSTGRES_PORT || 5432)),
  checkHttp(
    "minio",
    `http://127.0.0.1:${process.env.EVIMESH_S3_PORT || 9000}/minio/health/live`,
  ),
  checkHttp(
    "mailpit",
    `http://127.0.0.1:${process.env.EVIMESH_MAILPIT_PORT || 8025}/api/v1/info`,
  ),
  checkHttp("api", process.env.EVIMESH_API_URL || "http://127.0.0.1:8787/health"),
  checkHttp("web", process.env.EVIMESH_WEB_URL || "http://127.0.0.1:3000", { optional: true }),
]);

const hostedChecks = await Promise.all([
  checkHttp(
    "supabase",
    process.env.SUPABASE_URL
      ? `${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/health`
      : undefined,
  ),
  checkHttp("r2", process.env.R2_ENDPOINT, { optional: true }),
]);
const checks = [docker, ...localChecks, ...hostedChecks];

if (jsonOutput) {
  console.log(JSON.stringify({ checks }, null, 2));
} else {
  console.log("EviMesh infrastructure doctor");
  for (const check of checks) {
    console.log(`${check.status.toUpperCase().padEnd(7)} ${check.name.padEnd(10)} ${check.detail}`);
  }
}

process.exit(checks.some(({ status }) => status === "fail") ? 1 : 0);
