import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

/*
 * M13.8 redesign contracts (docs/design/05-core-ui-spec.md). These freeze the
 * landing / home / explore / work content rules and the manual-theme plumbing.
 */

test('landing does exactly its four jobs: positioning, example, two paths, trust', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /Make every research step traceable/);
  assert.match(page, /Open distributed scientific network/);
  assert.match(page, /href="\/agent"/);
  assert.match(page, /Connect your agent/);
  assert.match(page, /href="\/explore"/);
  assert.match(page, /Explore research/);
  assert.match(page, /What a research question looks like here/);
  assert.match(page, /Where the trust comes from/);
  for (const trust of ['Verified research identity', 'Immutable revisions', 'signed event chain', 'Shareable permanent links']) {
    assert.match(page, new RegExp(trust));
  }
});

test('landing never fakes live data or sells a score', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /Counts are entry points, never scores/);
  assert.doesNotMatch(page, /support score|truth score|percentage of support/i);
});

test('home renders attention-tiered sections with status badges and copyable ids', async () => {
  const page = await read('../app/home/page.js');
  assert.match(page, /attention priority, never the truth/);
  assert.match(page, /StatusBadge/);
  assert.match(page, /IdChip/);
  for (const section of ['Open questions', 'Claims awaiting verification', 'Latest frontiers', 'Newcomer tasks']) {
    assert.match(page, new RegExp(section));
  }
});

test('explore is one search surface with type filters and honest ordering', async () => {
  const page = await read('../app/explore/page.js');
  assert.match(page, /aria-label="Search research"/);
  assert.match(page, /Object types are filters here, not navigation/);
  for (const label of ['Questions', 'Projects', 'Claims']) {
    assert.match(page, new RegExp(`label: '${label}'`));
  }
  assert.match(page, /role="tablist"/);
  assert.match(page, /Clear filters/);
  assert.match(page, /Sorting never expresses research value or support/);
  assert.match(page, /ErrorState/);
  assert.match(page, /Skeleton/);
});

test('work keeps every write workflow one click away', async () => {
  const page = await read('../app/work/page.js');
  for (const href of ['/questions/new', '/claims/new', '/evidence/new', '/challenges/new', '/runs/new', '/verification/receipt/new']) {
    assert.ok(page.includes(`href: '${href}'`), `Work page is missing ${href}`);
  }
  for (const link of ['/tasks', '/verification', '/contributions', '/events']) {
    assert.ok(page.includes(`href="${link}"`), `Work page is missing ${link}`);
  }
  assert.match(page, /never a score/);
  assert.match(page, /never points or rankings/);
});

test('status badges map protocol states onto dual-tier variants, text first', async () => {
  const data = await read('../components/ui/data.js');
  assert.match(data, /resolveStatusVariant/);
  for (const pair of [
    "refuted: 'emphasis-danger'",
    "contested: 'status-warning'",
    "under_verification: 'status-accent'",
    "provisionally_accepted: 'status-success'",
    "supports: 'status-success'",
    "refutes: 'status-danger'",
    "qualifies: 'status-warning'",
    "reproduces: 'status-info'",
    "critical: 'emphasis-danger'",
    "attention: 'status-warning'",
  ]) {
    assert.ok(data.includes(pair), `status map is missing ${pair}`);
  }
  // Emphasis stays rare: only refuted and upheld claim-challenge states use it.
  const emphasisStates = [...data.matchAll(/(\w+): 'emphasis-[^']+'/g)].map((m) => m[1]);
  assert.deepEqual([...emphasisStates].sort(), ['critical', 'refuted', 'upheld']);
});

test('IdChip truncates ids, keeps the full value copyable, and gives feedback', async () => {
  const chip = await read('../components/ui/idchip.js');
  assert.match(chip, /navigator\.clipboard\.writeText\(value\)/);
  assert.match(chip, /title=\{value\}/);
  assert.match(chip, /aria-label=\{copied === true \? 'Copied'/);
  assert.match(chip, /tabular-nums/);
});

test('manual theme toggle persists and the layout applies it before first paint', async () => {
  const [toggle, layout, globals] = await Promise.all([
    read('../components/theme-toggle.js'),
    read('../app/layout.js'),
    read('../app/globals.css'),
  ]);
  assert.match(toggle, /localStorage.setItem\(STORAGE_KEY/);
  assert.match(toggle, /matchMedia\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(toggle, /setAttribute\('data-theme', value\)/);
  assert.match(layout, /localStorage.getItem\("evimesh-theme"\)/);
  assert.match(layout, /data-theme="auto"/);
  assert.match(globals, /\[data-theme="dark"\] \{/);
  assert.match(globals, /:root:not\(\[data-theme="light"\]\) \{/);
});

test('workspace offers six protocol views with DAG framing and no scores', async () => {
  const page = await read('../app/questions/[questionId]/page.js');
  for (const label of ['Summary', 'Current frontier', 'Argument', 'Evidence', 'Verification & challenges', 'Activity']) {
    assert.match(page, new RegExp(`label: '${label}'`), `workspace is missing view ${label}`);
  }
  assert.match(page, /fourteen directed edge types forming a DAG, never a parent-child tree/);
  assert.match(page, /counts are navigation, never a score|Grouped counts are navigation/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /objectType=question&objectId=/);
});

test('claim detail reads in serif with a status-summary rail', async () => {
  const page = await read('../app/claims/[claimId]/page.js');
  assert.match(page, /font-serif/);
  assert.match(page, /Status summary/);
  assert.match(page, /Counts are entry points, never scores/);
  assert.match(page, /keyboard-reachable equivalent/);
});

test('handoff sheets carry intent, object, and return path but never credentials', async () => {
  const sheet = await read('../components/handoff-sheet.js');
  assert.match(sheet, /It never carries credentials|never carries credentials/);
  assert.match(sheet, /navigator\.clipboard\.writeText/);
  assert.match(sheet, /continuation:/);
  assert.match(sheet, /Permalink/);
  for (const block of ['Natural-language task', 'Suggested CLI', 'Suggested MCP']) {
    assert.match(sheet, new RegExp(block));
  }
  const [claim, workspace] = await Promise.all([read('../app/claims/[claimId]/page.js'), read('../app/questions/[questionId]/page.js')]);
  for (const page of [claim, workspace]) {
    assert.match(page, /import \{ HandoffSheet \}/);
    assert.match(page, /setHandoffOpen\(true\)/);
    assert.match(page, /<HandoffSheet/);
  }
});

test('agent center walks six steps and keeps the manual as Markdown', async () => {
  const [page, route] = await Promise.all([read('../app/agent/page.js'), read('../app/agent.md/route.js')]);
  for (const step of ['Choose a client', 'Sign in and grant least privilege', 'Add the connection config', 'Test the connection', 'Read a real public question', 'Check provenance and continue']) {
    assert.match(page, new RegExp(`title: '${step}'`), `agent center is missing step ${step}`);
  }
  assert.match(page, /href="\/agent\.md"/);
  assert.match(page, /never real credentials|never appear on this page/);
  assert.match(page, /confirm \+ signature/);
  assert.match(page, /Revoke or narrow grants/);
  assert.match(route, /new Response\(agentManualMarkdown/);
});

test('command palette is keyboard-first and delegates object search to Explore', async () => {
  const palette = await read('../components/command-palette.js');
  assert.match(palette, /ctrlKey \|\| event\.metaKey/);
  assert.match(palette, /event\.key === '\/'/);
  assert.match(palette, /ArrowDown/);
  assert.match(palette, /ArrowUp/);
  assert.match(palette, /role="listbox"/);
  assert.match(palette, /\/explore\?q=/);
  const shell = await read('../components/template-shell.js');
  assert.match(shell, /<CommandPalette \/>/);
});

test('settings covers five sections with the ORCID OAuth-only rule', async () => {
  const page = await read('../app/settings/page.js');
  for (const id of ['s-profile', 's-identities', 's-tokens', 's-security', 's-notifications']) {
    assert.ok(page.includes(`id: '${id}'`), `settings is missing section ${id}`);
  }
  assert.match(page, /a manually typed iD can never show as verified/);
  assert.match(page, /shown exactly once/);
  assert.match(page, /attention priority, never a verdict/);
});

test('notifications ships its honest empty state, not a fake feed', async () => {
  const page = await read('../app/notifications/page.js');
  assert.match(page, /No notifications yet/);
  assert.match(page, /Discover research to follow/);
  assert.match(page, /subscription-driven|Subscription-driven/);
});

test('contributor page shows roles and traceable activity without rankings', async () => {
  const page = await read('../app/contributors/[actorId]/page.js');
  for (const section of ['Roles', 'Produced', 'Used', 'Frontier usage']) {
    assert.match(page, new RegExp(section));
  }
  assert.match(page, /No points, no rankings/);
  assert.match(page, /\/actors\/\$\{actorId\}/);
});

test('attempt trail keeps agent attribution explicit and publishing human', async () => {
  const page = await read('../app/attempts/[attemptId]/page.js');
  assert.match(page, /Agents draft; humans approve what gets signed/);
  assert.match(page, /objectType=attempt&objectId=/);
  assert.match(page, /No signed events for this attempt yet/);
  assert.match(page, /attribution chains are part of the record/i);
  assert.match(page, /Failed, paused, or abandoned attempts keep their links/);
  assert.match(page, /StatusBadge/);
});

test('list endpoints are hydrated before relation grouping (Codex P1s)', async () => {
  const [hydrate, claim, workspace] = await Promise.all([
    read('../lib/hydrate.mjs'),
    read('../app/claims/[claimId]/page.js'),
    read('../app/questions/[questionId]/page.js'),
  ]);
  // Evidence rows gain claimLinks from /evidence/:id; receipts gain findings
  // from /verifications/:receiptId; calls run in bounded chunks.
  assert.match(hydrate, /\/evidence\/\$\{item\.evidenceId\}/);
  assert.match(hydrate, /claimLinks/);
  assert.match(hydrate, /\/verifications\/\$\{receipt\.receiptId\}/);
  assert.match(hydrate, /findings/);
  assert.match(hydrate, /chunkMap/);
  for (const page of [claim, workspace]) {
    assert.match(page, /hydrateEvidenceLinks/);
    assert.match(page, /hydrateReceiptFindings|evidenceRelations/);
  }
});

test('workspace keeps only this question\'s tasks and claims and loads frontier members', async () => {
  const page = await read('../app/questions/[questionId]/page.js');
  assert.match(page, /taskItems\.filter\(\(task\) => task\.questionId === questionId\)/);
  assert.match(page, /claimItems\.filter\(\(claim\) => claim\.questionId === questionId\)/);
  assert.match(page, /frontier\/history\?limit=100/);
  assert.match(page, /snapshot\.snapshotId === frontier\.snapshotId/);
  // Question-wide views page through the claim list instead of one request.
  assert.match(page, /fetchAllClaims/);
  assert.match(page, /body\.nextCursor/);
  assert.doesNotMatch(page, /\.slice\(0, 8\)/);
});

test('no interactive control is nested inside a navigation link', async () => {
  const [claim, workspace, explore] = await Promise.all([
    read('../app/claims/[claimId]/page.js'),
    read('../app/questions/[questionId]/page.js'),
    read('../app/explore/page.js'),
  ]);
  for (const [name, page] of [['claim', claim], ['workspace', workspace], ['explore', explore]]) {
    assert.doesNotMatch(page, /<Link[^>]*>\s*<IdChip/, `${name} page nests IdChip inside a Link`);
  }
  const chip = await read('../components/ui/idchip.js');
  assert.match(chip, /event\.preventDefault\(\)/);
  assert.match(chip, /event\.stopPropagation\(\)/);
});

test('Docs forwards to the Markdown manual, not the connection wizard', async () => {
  const docs = await read('../app/docs/page.js');
  assert.match(docs, /redirect\('\/agent\.md'\)/);
});

test('agent center and handoffs use registered MCP tools and CLI commands', async () => {
  const [agent, claim, workspace] = await Promise.all([
    read('../app/agent/page.js'),
    read('../app/claims/[claimId]/page.js'),
    read('../app/questions/[questionId]/page.js'),
  ]);
  // Catalog names match apps/mcp/src/tools.mjs registrations.
  for (const tool of ['search_open_tasks', 'get_task_context', 'create_claim', 'publish_submission', 'attach_evidence', 'submit_verification']) {
    assert.ok(agent.includes(tool), `tool catalog is missing ${tool}`);
  }
  assert.doesNotMatch(agent, /name: '(search|get_frontier|draft_claim|publish_signed)'/);
  // Handoff suggestions are real commands from the sq table and MCP tools.
  assert.match(claim, /sq provenance/);
  assert.match(claim, /sq verify checkout/);
  assert.match(claim, /evimesh:\/\/claims\/\$\{claim\.claimId\}\/revisions\/\$\{currentRevision\.revision\}/);
  assert.match(claim, /attach_evidence \(confirm: true\)/);
  assert.match(workspace, /sq question list --project/);
  assert.match(workspace, /search_open_tasks \(read-only\)/);
  for (const page of [claim, workspace]) {
    assert.doesNotMatch(page, /claims inspect|questions inspect|draft_evidence|publish_signed/);
  }
});

test('command palette Enter executes the active command before search fallback', async () => {
  const palette = await read('../components/command-palette.js');
  assert.match(palette, /if \(results\[active\]\) \{\s*go\(results\[active\]\.href\);/);
  assert.match(palette, /\/explore\?q=/);
});
