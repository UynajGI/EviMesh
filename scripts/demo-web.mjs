/* Start the web dev server against the local demo API stack. Read-only
 * helper: the AGENTS.md pnpm trap means these run through node directly. */
import { spawnSync } from "node:child_process";

const generatePath = new URL("build-docs-content.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const generated = spawnSync("node", [generatePath], { stdio: "inherit" });
// A failed regeneration would silently serve stale committed docs.
if (generated.error || generated.status !== 0) {
  process.exit(generated.status ?? 1);
}

const result = spawnSync("node", ["node_modules/next/dist/bin/next", "dev"], {
  cwd: new URL("../apps/web", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_EVIMESH_API_URL: process.env.DEMO_API_URL ?? "http://127.0.0.1:8787" },
});
process.exit(result.status ?? 1);
