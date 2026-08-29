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

  assert.equal((page.match(/data-landing-cta-group/g) ?? []).length, 1, 'landing has one CTA group');
  assert.equal((page.match(/data-landing-cta="/g) ?? []).length, 2, 'landing CTA group has exactly two paths');
  assert.equal((page.match(/<section\b/g) ?? []).length, 3, 'attribution belongs to the example, not an extra panel');
  assert.doesNotMatch(page, /agent-heading|Read the agent manual/);

  const trustRows = page.match(/const TRUST_ROWS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
  assert.equal((trustRows.match(/\btitle:/g) ?? []).length, 4, 'trust list has exactly four rows');
  const trustSection = page.match(/<section aria-labelledby="trust-heading"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(trustSection, 'trust section is present');
  assert.doesNotMatch(trustSection, /<Card\b/, 'trust is a hairline list/grid, not a card wall');
});

test('landing never fakes live data or sells a score', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /Counts are entry points, never scores/);
  assert.doesNotMatch(page, /support score|truth score|percentage of support/i);
  assert.doesNotMatch(page, /(?:bg|text|border)-\[\s*#/i, 'landing has no raw color utilities');
  assert.doesNotMatch(page, /(?:from|via|to)-[a-z]/i, 'landing has no gradient utilities');
});

test('home restores the private watchlist change stream and design-book hierarchy', async () => {
  const page = await read('../app/home/page.js');
  assert.match(page, /fetchMyInteractions\(\['watch'\]\)/);
  assert.match(page, /Seven-day observation window:/);
  assert.match(page, /Change levels show attention priority, not truth, acceptance, or evidence quality/);
  for (const filter of ['objectType', 'objectId', 'createdAfter', 'createdBefore', "order: 'desc'", 'EVENTS_PER_OBJECT']) {
    assert.ok(page.includes(filter), `home event query missing ${filter}`);
  }
  assert.match(page, /const MAX_WATCHED_OBJECTS = 24/);
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /eventsById = new Map/);
  assert.match(page, /sort\(sortNewestProtocolOrder\)/);
  for (const level of ["return 'critical'", "return 'attention'", "return 'update'"]) assert.ok(page.includes(level));
  assert.match(page, /criticalFinding/);
  assert.match(page, /upheldChallengeWithImpact/);
  assert.match(page, /hydrateClassificationContexts\(merged\.events\)/);
  // Progressive hydration: the first paint renders unhydrated events and the
  // bounded detail fetches refine levels afterwards, never blocking render.
  assert.match(page, /setEvents\(merged\.events\);\n *setPartial\(basePartial\);\n *setStatus\('ready'\);/);
  assert.match(page, /const classified = await hydrateClassificationContexts\(merged\.events\);\n *if \(generation !== loadGeneration\.current\) return;\n *setEvents\(classified\.events\);/);
  assert.match(page, /\/verifications\/\$\{encodeURIComponent\(target\.id\)\}/);
  assert.match(page, /\/challenges\/\$\{encodeURIComponent\(target\.id\)\}/);
  assert.match(page, /classificationContext\.findingSeverity/);
  assert.match(page, /classificationContext\.challengeHasImpact === true/);
  assert.match(page, /failedDetails/);
  assert.match(page, /const MAX_CLASSIFICATION_DETAILS = 48/);
  assert.match(page, /allValues\.slice\(0, MAX_CLASSIFICATION_DETAILS\)/);
  assert.match(page, /omittedDetails/);
  assert.match(page, /refutingEvidence/);
  assert.match(page, /const createdChallenge = type === 'challenge\.created'/);
  assert.match(page, /majorFinding \|\| createdChallenge \|\| investigatingChallenge/);
  assert.match(page, /investigatingChallenge/);
  assert.match(page, /Quiet is not asserted/);
  assert.match(page, /carried-active-impact evidence are not exposed/);
  assert.match(page, /const grants = Array\.isArray\(payload\)/, 'agent grant totals accept the documented array response');
  assert.match(page, /function apiGrantIsActive\(grant, now = new Date\(\)\)/);
  assert.match(page, /expiresAt > now/, 'expired API grants are not reported as active');
  assert.match(page, /function eventAuditHref\(event, observationWindow\)/, 'event links retain the object scope and observation window');
  assert.match(page, /createdAfter: observationWindow\.windowStart/);
  assert.match(page, /createdBefore: observationWindow\.asOf/);
  assert.match(page, /frontierContextChanged = type\.includes\('frontier'\)[\s\S]*hasExplicitImpact\(payload\)/, 'ordinary frontier events are not guessed upward');
  assert.match(page, /ChangeGroup/);
  assert.match(page, /ChangeEvent/);
  assert.doesNotMatch(page, /<ChangeGroup count=/, 'change totals are not rendered as non-navigation badges');
  assert.doesNotMatch(page, /\{agentConnection\.activeGrantCount\}<\/span>/, 'active grant totals are not rendered as non-navigation counts');
  assert.match(page, /Active API grants are configured\./);
  assert.match(page, /Some watched objects were omitted from this bounded view/);
  assert.doesNotMatch(page, /loadedWatchCount/, 'partial coverage warnings do not render non-navigation totals');
  for (const rail of ['My work', 'Agent connection', 'Recently visited']) {
    assert.ok(page.includes(rail), 'home rail missing ' + rail);
  }
  assert.doesNotMatch(page, /fetchRecommendations|EngagementActions|break-inside-avoid|For you/);
});

test('landing shows a real live example with a graceful fallback', async () => {
  const [page, example] = await Promise.all([read('../app/page.js'), read('../components/landing-example.js')]);
  assert.match(page, /<LandingExample/);
  assert.match(page, /fallback={/);
  assert.match(page, />Demo data</);
  assert.match(page, /Illustrative frontier/);
  assert.doesNotMatch(page, /Frontier #\d+/);
  assert.match(page, /state="provisionally_accepted"/);
  assert.match(page, /state="contested"/);
  assert.match(page, /Human signer/);
  assert.match(page, /Agent draft/);
  assert.match(page, /Attribution never collapses an agent into a person/);
  assert.match(page, /Agents draft; humans approve what gets signed/);
  assert.match(page, /Demo data omits evidence totals because it has no exact records to open/);
  assert.match(page, /Contested; exact Challenge records are not included in demo data/);
  assert.doesNotMatch(page, /supports 5|refutes 1|qualifies 2|reproduces 3|One active challenge/);
  assert.match(example, /\/questions\?limit=8/);
  assert.match(example, /claim.questionId === question.questionId/);
  assert.match(example, /frontier\/latest/);
  assert.match(example, /Object\.values\(claim\.evidenceCounts\)\.some\(\(count\) => count > 0\)/);
  assert.doesNotMatch(example, /<span>supports 0<\/span>|<span>refutes 0<\/span>|<span>qualifies 0<\/span>|<span>reproduces 0<\/span>/);
  assert.doesNotMatch(page, /Frontier snapshot #\d+/);
});

test('workspace activity renders an icon timeline keyed by event type', async () => {
  const page = await read('../app/questions/[questionId]/page.js');
  assert.match(page, /type\.startsWith\('frontier'\) \? Mountain/);
  assert.match(page, /rounded-full bg-muted/);
  assert.match(page, /font-mono text-xs uppercase tracking-wide/);
});

test('explore is one search surface with type filters and honest ordering', async () => {
  const page = await read('../app/explore/page.js');
  assert.match(page, /aria-label="Search research"/);
  assert.match(page, /Object types are filters here, not navigation/);
  for (const label of ['Questions', 'Projects', 'Claims']) {
    assert.match(page, new RegExp(`label: '${label}'`));
  }
  assert.match(page, /<TabNav[\s\S]*?onChange=\{setType\}/);
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
  assert.match(layout, /data-theme="light"/);
  assert.match(globals, /\[data-theme="dark"\] \{/);
  assert.match(globals, /\[data-theme="dark"\] \{/);
});

test('workspace offers six protocol views with DAG framing and no scores', async () => {
  const page = await read('../app/questions/[questionId]/page.js');
  for (const label of ['Summary', 'Current frontier', 'Argument', 'Evidence', 'Verification & challenges', 'Activity']) {
    assert.match(page, new RegExp(`label: '${label}'`), `workspace is missing view ${label}`);
  }
  assert.match(page, /Claims form a DAG of typed edges, never a tree/);
  assert.match(page, /grouped counts are navigation, not a score/i);
  // Workspace views render through the shared TabNav (11 §4.1).
  assert.match(page, /<TabNav active=\{view\} ariaLabel="Workspace views"/);
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

test('agent activity accepts machine actors and rejects other actor types', async () => {
  const page = await read('../app/agents/[actorId]/page.js');
  assert.match(page, /actor\.actorType !== 'agent' && actor\.actorType !== 'service'/);
  assert.match(page, /Agent not found\. This Actor is not registered as an agent or service\./);
  assert.ok(page.indexOf("actor.actorType !== 'agent'") < page.indexOf('setData(payload)'), 'actor type must be checked before the agent UI is rendered');
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
  assert.match(page, /Enable the ORCID provider to connect/);
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
  assert.match(page, /This agent's public output/);
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

test('Docs is a real homepage built from the product manifest', async () => {
  const docs = await read('../app/docs/page.js');
  assert.match(docs, /loadDocsManifest/);
  assert.doesNotMatch(docs, /redirect\(/);
  assert.match(docs, /\/docs\/getting-started\/researcher/);
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

test('command palette Enter executes the active row before search fallback', async () => {
  const palette = await read('../components/command-palette.js');
  // Enter prefers the highlighted row; rows may be navigation or actions.
  assert.match(palette, /if \(results\[active\]\) \{\s*run\(results\[active\]\);/);
  assert.match(palette, /\/explore\?q=/);
  // Mockup groups: actions (permalink copy), theme, and a bounded object search.
  assert.match(palette, /group: 'Actions'/);
  assert.match(palette, /copy-permalink/);
  assert.match(palette, /group: 'Theme'/);
  assert.match(palette, /theme-light/);
  assert.match(palette, /group: 'Objects'/);
  assert.match(palette, /OBJECT_SOURCES/);
  assert.match(palette, /limit=20/);
});

test('web reads, agents write: handoff is the primary action, forms are fallback', async () => {
  const [work, task] = await Promise.all([
    read('../app/work/page.js'),
    read('../app/tasks/[taskId]/page.js'),
  ]);
  // Work: handoff primary above the demoted manual fallback.
  assert.match(work, /Hand new work to your agent/);
  assert.match(work, /Manual submission \(fallback for no-agent and accessibility paths\)/);
  assert.match(work, /<HandoffSheet/);
  for (const href of ['/questions/new', '/claims/new', '/evidence/new', '/challenges/new', '/runs/new', '/verification/receipt/new']) {
    assert.ok(work.includes(`href: '${href}'`), `fallback must stay reachable: ${href}`);
  }
  // Task detail: agent handoff primary; manual attempt explicitly labeled fallback.
  assert.match(task, /Run this task with an agent/);
  assert.match(task, /<HandoffSheet/);
  assert.match(task, /manual fallback/);
  assert.match(task, /Start Attempt/);
});

test('design chapters 03/04/08 land in production: truncation, motion, states', async () => {
  const [globals, dialog, chip, feedback, shell] = await Promise.all([
    read('../app/globals.css'),
    read('../components/ui/dialog.js'),
    read('../components/ui/idchip.js'),
    read('../components/ui/feedback.js'),
    read('../components/template-shell.js'),
  ]);
  // 04 §6: global reduced-motion kill-switch and dialog M8 enter.
  assert.match(globals, /prefers-reduced-motion: reduce/);
  assert.match(dialog, /evimesh-dialog-enter/);
  assert.match(globals, /evimesh-dialog-enter 160ms/);
  // 03 §4: prefix + first-6 + ellipsis + last-4 truncation.
  assert.match(chip, /value\.slice\(0, underscore \+ 6\)/);
  assert.match(chip, /value\.slice\(-4\)/);
  // 08 §1: blank family carries icon discs; denied exists; offline banner is mounted.
  for (const icon of ['Inbox', 'CircleAlert', 'Lock']) assert.ok(feedback.includes(icon), `blank family missing ${icon}`);
  assert.match(feedback, /export function DeniedState/);
  assert.match(feedback, /missing scope/);
  assert.match(shell, /<OfflineBanner \/>/);
  const banner = await read('../components/offline-banner.js');
  assert.match(banner, /navigator\.onLine/);
  assert.match(banner, /addEventListener\('online'/);
});

test('mockup-vs-production row actions and attribution land', async () => {
  const [claim, workspace, work, explore] = await Promise.all([
    read('../app/claims/[claimId]/page.js'),
    read('../app/questions/[questionId]/page.js'),
    read('../app/work/page.js'),
    read('../app/explore/page.js'),
  ]);
  // Claim fields render readable first; raw JSON moves into technical details.
  assert.match(claim, /function ReadableField/);
  assert.match(claim, /Raw structured fields/);
  assert.match(claim, /ReadableField value=\{currentRevision\.scope\}/);
  // Workspace activity carries actor attribution links (mockup Activity tab).
  assert.match(workspace, /Contributed by/);
  assert.ok(workspace.includes('actorHref(event.actorId)'), 'attribution must use the type-aware contributor route');
  // Work and Explore rows carry the per-row agent handoff (mockup row actions).
  for (const [name, page] of [['work', work], ['explore', explore]]) {
    assert.match(page, /Hand to agent/, `${name} rows missing the handoff action`);
    assert.match(page, /rowHandoff/);
    assert.match(page, /<HandoffSheet/);
  }
});

/*
 * Full-mockup audit pass (docs/design/html, 17 mockups): sections the first
 * fidelity pass missed. Each block freezes one mockup section against its
 * production implementation.
 */

test('home rail carries the local recently-visited card (mockup 最近访问)', async () => {
  const [lib, home, question, claim, project] = await Promise.all([
    read('../lib/visit-history.mjs'),
    read('../app/home/page.js'),
    read('../app/questions/[questionId]/page.js'),
    read('../app/claims/[claimId]/page.js'),
    read('../app/projects/[projectId]/page.js'),
  ]);
  assert.match(lib, /evimesh\.visit-history\.v1/);
  assert.match(lib, /const CAP = 8/);
  assert.match(lib, /export function recordVisit/);
  assert.match(lib, /export function readVisitHistory/);
  assert.match(lib, /export function useVisitRecord/);
  // The history never leaves the browser.
  assert.match(lib, /typeof window === 'undefined'/);
  assert.doesNotMatch(lib, /fetch\(/);
  assert.match(home, /Recently visited/);
  assert.match(home, /readVisitHistory/);
  // Every object detail page records its visit once a readable label exists.
  for (const [name, page, kind] of [['question', question, 'question'], ['claim', claim, 'claim'], ['project', project, 'project']]) {
    assert.ok(page.includes('useVisitRecord('), `${name} page never records visits`);
    assert.ok(page.includes(`kind: '${kind}'`), `${name} page records the wrong kind`);
  }
});

test('explore ships the derived researchers tab and the 30-day window (mockup 研究者 / 筛选)', async () => {
  const page = await read('../app/explore/page.js');
  assert.match(page, /\{ id: 'researcher', label: 'Researchers' \}/);
  assert.match(page, /Last 30 days/);
  // Researchers derive from real attribution only; ordering is recency, never counts.
  assert.match(page, /createdBy/);
  assert.match(page, /Derived from attribution on the currently loaded questions and claims/);
  assert.match(page, /entry points, never contribution scores/);
  assert.match(page, /Date\.parse\(right\.lastWhen \?\? 0\) - Date\.parse\(left\.lastWhen \?\? 0\)/);
  assert.doesNotMatch(page, /sort\([^)]*count[^)]*\)/);
});

test('agent center carries Read with an agent and Security and revocation (mockup ac-read / ac-security)', async () => {
  const page = await read('../app/agent/page.js');
  assert.match(page, /Read with an agent/);
  assert.match(page, /Argument, Evidence, Verification, Frontier/);
  assert.match(page, /resume the same context from a web handoff sheet/);
  // The tool table lists tool, category, and write level columns.
  for (const header of ['<th scope="col" className="px-4 py-2.5 font-medium">Tool</th>', '>Category</th>', '>Write level</th>', '>What it does</th>']) {
    assert.ok(page.includes(header), `tool table missing column ${header}`);
  }
  assert.match(page, /Security and revocation/);
  assert.match(page, /Scopes are least-privilege by default/);
  assert.match(page, /Revocation is one page away/);
  assert.match(page, /Tokens never travel in pages/);
  assert.match(page, /Token hygiene/);
  assert.match(page, /environment-variable placeholders/);
});

test('contributor page renders the signed contribution timeline, projects, and agents rail (mockup 公开贡献 / 参与的项目 / 她的 Agent)', async () => {
  const page = await read('../app/contributors/[actorId]/page.js');
  assert.match(page, /Public contributions/);
  assert.match(page, /By role and time; never ranked, never scored/);
  assert.match(page, /data\.statements/);
  assert.match(page, /\.slice\(0, 12\)/);
  assert.match(page, /Projects involved/);
  assert.match(page, /PROJECT_HYDRATE_LIMIT = 6/);
  assert.match(page, /objectType === 'project'/);
  assert.match(page, /Agents acting for this contributor/);
  // The agents rail is an honest data gate, never fabricated agent cards.
  assert.match(page, /No agent registry exposed yet/);
  assert.match(page, /once the agent registry is exposed through the public API/);
});

test('workspace summary ships disputes and verification blocks with real findings (mockup 主要争议与验证阻塞)', async () => {
  const page = await read('../app/questions/[questionId]/page.js');
  assert.match(page, /Disputes and verification blocks/);
  assert.match(page, /Attention level only/);
  // Findings hydrate from receipts for attention claims only, bounded both ways.
  assert.match(page, /attentionClaimIds\.slice\(0, 6\)/);
  assert.match(page, /rows\.slice\(0, 10\)/);
  assert.match(page, /finding\.severity === 'critical' \|\| finding\.severity === 'major'/);
  assert.match(page, /hydrateReceiptFindings\(API, groups\.flat\(\)\)/);
  // Challenge rows stay gated behind the public API, honestly.
  assert.match(page, /Challenge tracking lives on each claim; open challenges are listed there/);
});
