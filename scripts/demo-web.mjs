/* Start the web dev server against the local demo API stack. Read-only
 * helper: the AGENTS.md pnpm trap means these run through node directly. */
import { spawnSync } from "node:child_process";

const result = spawnSync("node", ["node_modules/next/dist/bin/next", "dev"], {
  cwd: new URL("../apps/web", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_EVIMESH_API_URL: process.env.DEMO_API_URL ?? "http://127.0.0.1:8787" },
});
process.exit(result.status ?? 1);
