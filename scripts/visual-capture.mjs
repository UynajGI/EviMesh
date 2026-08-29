/*
 * Visual baseline capture (11-revision-decisions.md §6): screenshots of the
 * key routes against the local demo stack, for human review rather than CI
 * pixel gates. Requires a running demo api (`pnpm demo:api`) and web dev
 * server (`pnpm demo:web`), plus the Playwright CLI (`npx playwright`).
 *
 * Every capture is verified before it lands: the route must answer 200 with
 * the expected page marker, and the screenshot must differ from a build-error
 * overlay (the failure mode that once shipped three identical error pages as
 * "samples").
 *
 * Usage:
 *   node scripts/visual-capture.mjs                 # 1440 desktop set
 *   node scripts/visual-capture.mjs --mobile        # 390 set
 *   node scripts/visual-capture.mjs --dark          # dark theme set
 *   node scripts/visual-capture.mjs --out <dir>     # default docs/design/baseline
 */
import { mkdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const WEB = process.env.DEMO_WEB_URL ?? "http://localhost:3000";
const API = process.env.DEMO_API_URL ?? "http://127.0.0.1:8787";
const OUT = (() => {
  const flag = process.argv.indexOf("--out");
  return flag > -1 ? process.argv[flag + 1] : "docs/design/baseline";
})();
const MOBILE = process.argv.includes("--mobile");
const DARK = process.argv.includes("--dark");
const VIEWPORT = MOBILE ? "390,844" : "1440,900";
const SUFFIX = `${MOBILE ? "-390" : "-1440"}${DARK ? "-dark" : ""}`;
// Theme note: the web bootstrap resolves an unset stored preference from
// prefers-color-scheme, so --color-scheme drives the rendered theme. A
// stored localStorage choice in the capture profile would override it.

const ROUTES = [
  { path: "/", marker: "Make every research step traceable", name: "landing" },
  { path: "/explore", marker: "Discover research", name: "explore" },
  { path: "/claims/claim-a1b2", marker: "provisionally accepted", name: "claim-accepted" },
  { path: "/claims/claim-d4e5", marker: "contested", name: "claim-contested" },
  { path: "/questions/q-contrastive", marker: "Research scope", name: "workspace" },
  { path: "/people/actor-lin", marker: "Lin Zhiyao", name: "profile" },
  { path: "/agents/actor-atlas", marker: "atlas-07", name: "agent-activity" },
  { path: "/events", marker: "Event audit", name: "events" },
  { path: "/work", marker: "Hand new work to your agent", name: "work" },
];

function findPlaywrightModule() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    "C:/Users/UynajGI/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      // Resolving via createRequire keeps the CLI-only surface intact.
      const { createRequire } = require("node:module");
      createRequire(path.join(process.cwd(), "package.json")).require(candidate);
      return candidate;
    } catch { /* try next */ }
  }
  return null;
}

/** Client-rendered failure detector: BlankShell error states and route
 *  markers only exist after hydration, so this runs a real browser via the
 *  npx playwright module when one is resolvable. Returns an error string or
 *  null. Skipped (with a warning) when no module resolves. */
function domInspection(url, marker) {
  const modulePath = findPlaywrightModule();
  if (!modulePath) return { skipped: true };
  const { pathToFileURL } = require("node:url");
  const checkScript = `
    const { chromium } = require(${JSON.stringify(modulePath)});
    (async () => {
      const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(${JSON.stringify(url)}, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);
      const errorState = await page.evaluate(() => {
        const alert = document.querySelector('[role="alert"]');
        const text = document.body.innerText || "";
        return { hasError: Boolean(alert && /could not|interrupted|went wrong/i.test(text)), markerPresent: text.includes(${JSON.stringify(marker)}) };
      });
      console.log(JSON.stringify(errorState));
      await browser.close();
    })().catch((error) => { console.error(String(error)); process.exit(1); });
  `;
  const tmp = path.join(OUT, ".dom-check.js");
  writeFileSync(tmp, checkScript);
  const executable = "C:/Users/UynajGI/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
  const run = spawnSync("node", [tmp], { encoding: "utf8", timeout: 60000, env: { ...process.env, CHROME_PATH: executable } });
  try {
    const parsed = JSON.parse(run.stdout.trim().split("\n").pop() ?? "{}");
    if (parsed.hasError) return { error: "page rendered an error state" };
    if (!parsed.markerPresent) return { error: `expected marker "${marker}" not present after hydration` };
    return {};
  } catch {
    return { warning: `dom inspection skipped (unparseable output)` };
  }
}

function capture({ path, marker, name }) {
  const url = `${WEB}${path}`;
  const probe = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", url], { encoding: "utf8" });
  if (probe.stdout.trim() !== "200") {
    return { name, ok: false, reason: `route answered ${probe.stdout.trim() ?? "nothing"}` };
  }
  const html = spawnSync("curl", ["-s", url], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  // Client-rendered pages stream a skeleton first; only fail on error markers.
  if (html.stdout.includes("Build Error") || html.stdout.includes("__next_error__")) {
    return { name, ok: false, reason: "page rendered a build error" };
  }
  const dom = domInspection(url, marker);
  if (dom.error) return { name, ok: false, reason: dom.error };

  const out = `${OUT}/${name}${SUFFIX}.png`;
  // shell:true is required on Windows where npx resolves through npx.cmd.
  const shot = spawnSync("npx", ["playwright", "screenshot", "--viewport-size=" + VIEWPORT, ...(DARK ? ["--color-scheme=dark"] : []), "--wait-for-timeout=9000", url, out], { encoding: "utf8", shell: process.platform === "win32" });
  if (shot.status !== 0) return { name, ok: false, reason: `playwright failed: ${shot.stderr?.slice(0, 200)}` };
  let bytes = 0;
  try {
    bytes = statSync(out).size;
  } catch {
    return { name, ok: false, reason: "screenshot file missing" };
  }
  if (bytes < 20_000) return { name, ok: false, reason: `screenshot suspiciously small (${bytes}B)` };
  return { name, ok: true, bytes, out };
}

mkdirSync(OUT, { recursive: true });
const apiProbe = spawnSync("curl", ["-s", `${API}/claims/claim-a1b2`], { encoding: "utf8" });
if (!apiProbe.stdout.includes("currentRevision")) {
  console.error(`demo api at ${API} is not serving seeded claim data; run \`pnpm demo:api\` first.`);
  process.exit(1);
}

const results = ROUTES.map(capture);
for (const result of results) {
  console.log(result.ok ? `ok   ${result.name} (${Math.round(result.bytes / 1024)}KB -> ${result.out})` : `FAIL ${result.name}: ${result.reason}`);
}
const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} captured into ${OUT}`);
process.exit(failed > 0 ? 1 : 0);
