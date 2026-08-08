import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('initializes the Next App Router shell', async () => {
  const [manifest, layout, page, config, globals, postcss] = await Promise.all([
    read('../package.json'), read('../app/layout.js'), read('../app/page.js'), read('../next.config.mjs'), read('../app/globals.css'), read('../postcss.config.mjs'),
  ]);
  const packageJson = JSON.parse(manifest);
  assert.equal(packageJson.scripts.dev, 'next dev');
  assert.equal(packageJson.scripts.build, 'next build');
  assert.match(layout, /<html lang="en">/);
  assert.match(layout, /import '\.\/globals\.css';/);
  assert.match(page, /Open distributed scientific network/);
  assert.match(config, /turbopack: \{ root: workspaceRoot \}/);
  assert.match(globals, /@import "tailwindcss"/);
  assert.match(postcss, /'@tailwindcss\/postcss': \{\}/);
  assert.match(page, /<PageContainer>/);
  const pageTemplate = await read('../components/ui/page.js');
  assert.match(pageTemplate, /max-w-6xl/);
});

test('configures OpenNext for Cloudflare Workers deployment', async () => {
  const [manifest, nextConfig, workerConfig, openNextConfig, headers] = await Promise.all([
    read('../package.json'), read('../next.config.mjs'), read('../wrangler.jsonc'), read('../open-next.config.ts'), read('../public/_headers'),
  ]);
  const packageJson = JSON.parse(manifest);
  assert.match(packageJson.scripts.preview, /opennextjs-cloudflare preview/);
  assert.match(packageJson.scripts['deploy:production'], /opennextjs-cloudflare deploy --env production/);
  assert.match(nextConfig, /initOpenNextCloudflareForDev/);
  assert.match(workerConfig, /"main": "\.open-next\/worker\.js"/);
  assert.match(workerConfig, /"directory": "\.open-next\/assets"/);
  assert.match(openNextConfig, /defineCloudflareConfig/);
  assert.match(headers, /Cache-Control: public,max-age=31536000,immutable/);
});

test('configures shadcn-compatible Button, Input, and Dialog components', async () => {
  const [config, button, input, dialog] = await Promise.all([
    read('../components.json'), read('../components/ui/button.js'), read('../components/ui/input.js'), read('../components/ui/dialog.js'),
  ]);
  assert.equal(JSON.parse(config).tailwind.config, '');
  assert.match(button, /export function Button/);
  assert.match(input, /export function Input/);
  assert.match(dialog, /export function DialogContent/);
});

test('defines light and dark design tokens for the web product', async () => {
  const globals = await read('../app/globals.css');
  assert.match(globals, /@theme inline/);
  assert.match(globals, /--color-background: var\(--evimesh-background\)/);
  assert.match(globals, /--color-primary: var\(--evimesh-primary\)/);
  assert.match(globals, /:root \{[\s\S]*--evimesh-background:/);
  assert.match(globals, /@media \(prefers-color-scheme: dark\) \{[\s\S]*--evimesh-background:/);
});

test('provides primary navigation and the initial product routes', async () => {
  const [layout, nav, projects, tasks, verification, contributions] = await Promise.all([
    read('../app/layout.js'), read('../components/site-nav.js'), read('../app/projects/page.js'), read('../app/tasks/page.js'), read('../app/verification/page.js'), read('../app/contributions/page.js'),
  ]);
  assert.match(layout, /<SiteNav \/>/);
  assert.match(nav, /aria-label="Primary navigation"/);
  // First-level navigation is capped at six items; overflow actions still exist.
  const primarySection = nav.slice(0, nav.indexOf('const overflowLinks'));
  const primaryHrefs = (primarySection.match(/\{ href: '([^']+)', label: '[^']+' \}/g) ?? []).map((entry) => entry.match(/href: '([^']+)'/)[1]);
  assert.ok(primaryHrefs.length <= 6, `primary navigation has ${primaryHrefs.length} items`);
  for (const href of ['/projects', '/questions', '/tasks', '/claims', '/verification', '/events']) assert.ok(primaryHrefs.includes(href), `missing ${href} in primary navigation`);
  for (const page of [verification, contributions]) assert.match(page, /SectionPlaceholder/);
  assert.match(tasks, /Task board/);
  assert.match(projects, /Create a project/);
});

test('renders a recoverable global error state with an API request ID', async () => {
  const errorPage = await read('../app/error.js');
  assert.match(errorPage, /'use client'/);
  assert.match(errorPage, /export function requestIdFrom/);
  assert.match(errorPage, /error\?\.request_id/);
  assert.match(errorPage, /request_id: \{requestId\}/);
  assert.match(errorPage, /onClick=\{reset\}/);
});

test('provides loading skeletons for each main product route', async () => {
  const [skeleton, root, projects, tasks, verification, contributions] = await Promise.all([
    read('../components/page-skeleton.js'), read('../app/loading.js'), read('../app/projects/loading.js'), read('../app/tasks/loading.js'), read('../app/verification/loading.js'), read('../app/contributions/loading.js'),
  ]);
  assert.match(skeleton, /aria-busy="true"/);
  assert.match(skeleton, /animate-pulse/);
  for (const loading of [root, projects, tasks, verification, contributions]) assert.match(loading, /PageSkeleton/);
});

test('provides Supabase email and GitHub authentication from the sign-in page', async () => {
  const [client, page] = await Promise.all([read('../lib/supabase-browser.js'), read('../app/sign-in/page.js')]);
  assert.match(client, /createClient\(url, key\)/);
  assert.match(client, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(page, /signInWithPassword/);
  assert.match(page, /signInWithOAuth\(\{ provider: 'github'/);
  assert.match(page, /Continue with GitHub/);
});

test('renders a reusable Cytoscape Claim DAG component', async () => {
  const [dag, verification] = await Promise.all([read('../components/claim-dag.js'), read('../app/verification/page.js')]);
  assert.match(dag, /import cytoscape from 'cytoscape'/);
  assert.match(dag, /return \(\) => cy\.destroy\(\)/);
  assert.match(dag, /Claim dependency graph/);
  assert.match(verification, /<ClaimDag elements=\{sampleElements\}/);
});

test('edits the authenticated actor profile through the API Edge', async () => {
  const page = await read('../app/settings/page.js');
  assert.match(page, /auth\.getSession/);
  assert.match(page, /NEXT_PUBLIC_EVIMESH_API_URL/);
  assert.match(page, /profileRequest\('\/profile'/);
  assert.match(page, /Save profile/);
});

test('manages API tokens with one-time secret display', async () => {
  const page = await read('../app/settings/tokens/page.js');
  assert.match(page, /call\('\/api-tokens'/);
  assert.match(page, /setSecret\(result\.token\)/);
  assert.match(page, /It cannot be shown again/);
  assert.match(page, /Revoke/);
});

test('renders open questions on the homepage by latest available activity', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /\/questions\?limit=20/);
  assert.match(page, /CLOSED_STATES/);
  assert.match(page, /Open questions/);
  assert.match(page, /Newest activity first/);
});

test('renders only claims awaiting verification on the homepage', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /under_verification/);
  assert.match(page, /provisionally_accepted/);
  assert.match(page, /Claims awaiting verification/);
});

test('renders each project latest frontier on the homepage', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /\/projects\?limit=6/);
  assert.match(page, /frontier\/latest/);
  assert.match(page, /Latest frontiers/);
  assert.match(page, /Frontier #/);
});

test('renders tagged newcomer tasks on the homepage', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /\['cpu-only', 'under-60-min'\]/);
  assert.match(page, /tag=\$\{tag\}/);
  assert.match(page, /Newcomer tasks/);
});

test('renders project details with Questions, Frontier, and Task summaries', async () => {
  const page = await read('../app/projects/[projectId]/page.js');
  assert.match(page, /\/projects\/\$\{projectId\}/);
  assert.match(page, /\/questions\?projectId=/);
  assert.match(page, /\/tasks\?projectId=/);
  assert.match(page, /Latest frontier/);
});

test('renders the project list and creation form', async () => {
  const page = await read('../app/projects/page.js');
  assert.match(page, /Create a project/);
  assert.match(page, /POST/);
  assert.match(page, /\/projects\/\$\{project\.projectId\}/);
});

test('renders the first Question submission step for question and value', async () => {
  const page = await read('../app/questions/new/page.js');
  assert.match(page, /Step 1 of 4/);
  assert.match(page, /Question statement/);
  assert.match(page, /Question value/);
  assert.match(page, /Continue to scope/);
});

test('supports the second Question submission step for scope and exclusions', async () => {
  const page = await read('../app/questions/new/page.js');
  assert.match(page, /Question scope/);
  assert.match(page, /Question exclusions/);
  assert.match(page, /Continue to progress/);
  assert.match(page, /setStep\(2\)/);
});

test('supports the third Question submission step for progress and falsification', async () => {
  const page = await read('../app/questions/new/page.js');
  assert.match(page, /Question progress/);
  assert.match(page, /Question falsification conditions/);
  assert.match(page, /Continue to permissions/);
  assert.match(page, /setStep\(3\)/);
});

test('supports the fourth Question submission step for license and risks', async () => {
  const page = await read('../app/questions/new/page.js');
  assert.match(page, /Question license/);
  assert.match(page, /Question risks/);
  assert.match(page, /Review question/);
  assert.match(page, /setStep\(4\)/);
});

test('renders a normalized Question preview before submission', async () => {
  const page = await read('../app/questions/new/page.js');
  assert.match(page, /Normalized question object/);
  assert.match(page, /JSON\.stringify\(draft/);
  assert.match(page, /Back to edit/);
  assert.match(page, /setPreview\(true\)/);
  assert.match(page, /POST/);
  assert.match(page, /Submit question/);
  assert.match(page, /router\.push\(`\/questions\/\$\{body\.question\.questionId\}`\)/);
});

test('renders Question details with Contract, state, and Task summaries', async () => {
  const page = await read('../app/questions/[questionId]/page.js');
  assert.match(page, /\/questions\/\$\{questionId\}/);
  assert.match(page, /Research Contract/);
  assert.match(page, /question\.state/);
  assert.match(page, /tasks\.length/);
});

test('renders the Task board with every protocol status lane', async () => {
  const page = await read('../app/tasks/page.js');
  for (const status of ['draft', 'open', 'active', 'blocked', 'verification_requested', 'completed', 'cancelled']) assert.match(page, new RegExp(`'${status}'`));
  assert.match(page, /Task board/);
  assert.match(page, /URLSearchParams\(\{ limit: '100' \}\)/);
});

test('provides Task filters for type, status, tag, and Context Mode', async () => {
  const page = await read('../app/tasks/page.js');
  for (const filter of ['Type', 'Status', 'Tag', 'Context Mode']) assert.match(page, new RegExp(filter));
  for (const mode of ['frontier', 'full_trace', 'adversarial', 'blind']) assert.match(page, new RegExp(`'${mode}'`));
  assert.match(page, /filters\.contextMode/);
  assert.match(page, /URLSearchParams/);
});

test('renders Task details with inputs, outputs, acceptance, dependencies, and leases', async () => {
  const page = await read('../app/tasks/[taskId]/page.js');
  assert.match(page, /\/tasks\/\$\{taskId\}/);
  for (const section of ['Inputs', 'Outputs', 'Acceptance', 'Dependencies', 'Leases']) assert.match(page, new RegExp(section));
  assert.match(page, /currentRevision\.contextMode/);
  assert.match(page, /currentRevision\.description/);
});

test('starts an Attempt and exposes a Context bundle download', async () => {
  const page = await read('../app/tasks/[taskId]/page.js');
  assert.match(page, /Start Attempt/);
  assert.match(page, /\/tasks\/\$\{taskId\}\/context/);
  assert.match(page, /contextBundleId/);
  assert.match(page, /Download Context bundle/);
  assert.match(page, /\/attempts/);
});

test('provides Task lease acquire and release actions', async () => {
  const page = await read('../app/tasks/[taskId]/page.js');
  assert.match(page, /Acquire lease/);
  assert.match(page, /Release my lease/);
  assert.match(page, /\/lease/);
  assert.match(page, /updateLease/);
});

test('renders the Claim list with status and tag filters', async () => {
  const [page, nav] = await Promise.all([read('../app/claims/page.js'), read('../components/site-nav.js')]);
  assert.match(page, /Claims/);
  assert.match(page, /claims\?/);
  assert.match(page, /filters\.status/);
  assert.match(page, /filters\.tag/);
  assert.match(page, /under_verification/);
  assert.match(nav, /href: '\/claims'/);
});

test('renders Claim details with statement, scope, falsification, and revisions', async () => {
  const page = await read('../app/claims/[claimId]/page.js');
  assert.match(page, /\/claims\/\$\{claimId\}/);
  for (const section of ['statement', 'Scope', 'Falsification conditions', 'Revision history']) assert.match(page, new RegExp(section));
  assert.match(page, /currentRevision\.revision/);
});

test('renders a Cytoscape Claim DAG on the Claim detail page', async () => {
  const page = await read('../app/claims/[claimId]/page.js');
  assert.match(page, /import \{ ClaimDag \}/);
  assert.match(page, /<ClaimDag elements=\{dagElements\} \/>/);
  assert.match(page, /Claim dependency graph/);
});

test('supports upstream and downstream Claim graph switching', async () => {
  const page = await read('../app/claims/[claimId]/page.js');
  assert.match(page, /direction=\$\{direction\}/);
  assert.match(page, /Upstream/);
  assert.match(page, /Downstream/);
  assert.match(page, /getClaimDownstreamGraph|graphNodes/);
});

test('renders a Claim DAG state legend with state-derived node colors', async () => {
  const component = await read('../components/claim-dag.js');
  assert.match(component, /CLAIM_STATE_COLORS/);
  assert.match(component, /background-color.*data\(color\)/);
  assert.match(component, /Claim state legend/);
});

test('opens Claim DAG node details with revision and Evidence fields', async () => {
  const component = await read('../components/claim-dag.js');
  assert.match(component, /Claim node details/);
  assert.match(component, /currentRevision\?\.revision/);
  assert.match(component, /Evidence:/);
  assert.match(component, /cy\.on\('tap', 'node'/);
});

test('renders Frontier time travel with fixed members', async () => {
  const [component, page] = await Promise.all([read('../components/frontier-timeline.js'), read('../app/projects/[projectId]/page.js')]);
  assert.match(component, /frontier\/history/);
  assert.match(component, /Select an immutable Frontier/);
  assert.match(component, /members\.map/);
  assert.match(page, /FrontierTimeline/);
});

test('renders the Claim editor for statement, scope, assumptions, and falsification', async () => {
  const [page, nav] = await Promise.all([read('../app/claims/new/page.js'), read('../components/site-nav.js')]);
  for (const field of ['Statement', 'Scope', 'Assumptions', 'Falsification conditions']) assert.match(page, new RegExp(field));
  assert.match(page, /Claim preview/);
  assert.match(nav, /claims\/new/);
});

test('persists claim drafts through IndexedDB and restores them on refresh', async () => {
  const store = await read('../lib/draft-store.js');
  const page = await read('../app/claims/new/page.js');
  assert.match(store, /indexedDB\.open/);
  assert.match(store, /createObjectStore\(STORE_NAME\)/);
  assert.match(store, /transaction\(STORE_NAME, 'readwrite'\)/);
  assert.match(page, /loadDraft\(DRAFT_KEY, INITIAL\)/);
  assert.match(page, /saveDraft\(DRAFT_KEY, form\)/);
  assert.match(page, /Draft restored from this browser/);
});

test('exports claim drafts as JSON and a real ZIP bundle', async () => {
  const bundle = await read('../lib/draft-bundle.js');
  const page = await read('../app/claims/new/page.js');
  assert.match(bundle, /kind: 'evimesh-draft-bundle'/);
  assert.match(bundle, /application\/zip/);
  assert.match(bundle, /claim-draft\.json/);
  assert.match(page, /downloadDraftBundle\(form, 'json'\)/);
  assert.match(page, /downloadDraftBundle\(form, 'zip'\)/);
});

test('imports validated JSON and stored ZIP draft bundles into the Claim editor', async () => {
  const bundle = await read('../lib/draft-bundle.js');
  const page = await read('../app/claims/new/page.js');
  assert.match(bundle, /readDraftBundle/);
  assert.match(bundle, /Unsupported EviMesh draft Bundle/);
  assert.match(bundle, /Compressed or invalid draft ZIP/);
  assert.match(page, /readDraftBundle\(file\)/);
  assert.match(page, /Draft imported/);
  assert.match(page, /accept=\"\.json,\.zip/);
});

test('keeps the Claim editor responsive at mobile and desktop breakpoints', async () => {
  const page = await read('../app/claims/new/page.js');
  const nav = await read('../components/site-nav.js');
  assert.match(page, /mx-auto max-w-5xl px-6/);
  assert.match(page, /flex flex-wrap gap-3/);
  assert.match(page, /overflow-x-auto/);
  // The shell collapses to a toggle below md instead of wrapping the nav row.
  assert.match(nav, /md:hidden/);
  assert.match(nav, /aria-expanded/);
  assert.match(nav, /gap-/);
});

test('provides basic accessible names and status semantics on key M9 pages', async () => {
  const [page, workspace, nav, events] = await Promise.all([
    read('../app/claims/new/page.js'),
    read('../components/verification-workspace.js'),
    read('../components/site-nav.js'),
    read('../app/events/page.js'),
  ]);
  assert.match(nav, /aria-label="Primary navigation"/);
  assert.match(page, /<h1 className=.*Draft a Claim/);
  assert.match(page, /<label className=.*Statement/);
  assert.match(page, /role="status"/);
  assert.match(page, /role="alert"/);
  assert.match(workspace, /aria-label="Verification workspace"/);
  assert.match(workspace, /aria-label="Blind Context"/);
  assert.match(events, /<h1 className=.*Event audit/);
  assert.match(events, /role="alert"/);
});

test('renders Claim revision diff controls and changed fields', async () => {
  const page = await read('../app/claims/[claimId]/diff/page.js');
  assert.match(page, /revisions\/\$\{revision\}/);
  assert.match(page, /From revision/);
  assert.match(page, /To revision/);
  assert.match(page, /Changed fields/);
});

test('renders direct R2 evidence upload with hash and progress', async () => {
  const panel = await read('../components/artifact-upload-panel.js');
  const page = await read('../app/artifacts/upload/page.js');
  assert.match(panel, /crypto\.subtle\.digest/);
  assert.match(panel, /artifacts\/upload-plan/);
  assert.match(panel, /fileName: file\.name/);
  assert.match(panel, /XMLHttpRequest/);
  assert.match(panel, /onprogress/);
  assert.match(panel, /SHA-256/);
  assert.match(page, /ArtifactUploadPanel/);
});

test('renders Artifact detail with hash, license, and locations', async () => {
  const page = await read('../app/artifacts/[artifactId]/page.js');
  assert.match(page, /artifacts\/\$\{artifactId\}/);
  assert.match(page, /rawHash/);
  assert.match(page, /license/);
  assert.match(page, /locations/);
});

test('renders Run Receipt form for environment, command, seed, and outputs', async () => {
  const page = await read('../app/runs/new/page.js');
  assert.match(page, /Run Receipt/);
  assert.match(page, /environment/);
  assert.match(page, /command/);
  assert.match(page, /randomSeed/);
  assert.match(page, /outputArtifactIds/);
  assert.match(page, /Preview Receipt/);
});

test('renders Evidence form linking Run, Artifact, and Claim revision', async () => {
  const page = await read('../app/evidence/new/page.js');
  assert.match(page, /Create Evidence/);
  assert.match(page, /artifactId/);
  assert.match(page, /runId/);
  assert.match(page, /claimRevision/);
  assert.match(page, /relationType/);
});

test('renders Verification workspace for Claim, Run, and Contract pinning', async () => {
  const page = await read('../components/verification-workspace.js');
  assert.match(page, /Verification workspace/);
  assert.match(page, /claimRevision/);
  assert.match(page, /runId/);
  assert.match(page, /contractRevision/);
  assert.match(page, /sawExpectedOutputs/);
  assert.match(page, /Blind Context/);
  assert.match(page, /Expected outputs hidden/);
  assert.match(page, /expectedOutputs: undefined/);
});

test('renders Verification Receipt form with outcome, independence, and findings', async () => {
  const page = await read('../components/verification-receipt-form.js');
  const route = await read('../app/verification/receipt/new/page.js');
  assert.match(page, /Verification Receipt/);
  assert.match(page, /outcome/);
  assert.match(page, /implementationRelation/);
  assert.match(page, /dataRelation/);
  assert.match(page, /findings/);
  assert.match(page, /fieldPath/);
  assert.match(page, /details: \{ text/);
  assert.match(page, /location: \{ fieldPath/);
  assert.match(route, /VerificationReceiptForm/);
});

test('renders Challenge form locking a Claim revision to counterexample Evidence', async () => {
  const page = await read('../app/challenges/new/page.js');
  assert.match(page, /Challenge a claim/);
  assert.match(page, /claimRevision/);
  assert.match(page, /counterexampleEvidenceId/);
  assert.match(page, /Rationale/);
});

test('renders Frontier detail with members, policy, checkpoint, and diff', async () => {
  const page = await read('../app/projects/[projectId]/frontier/[snapshotId]/page.js');
  assert.match(page, /frontier\/history/);
  assert.match(page, /Members/);
  assert.match(page, /Policy/);
  assert.match(page, /Checkpoint/);
  assert.match(page, /Member diff/);
});

test('renders contributor detail with roles, produced, used, and Frontier usage', async () => {
  const page = await read('../app/contributors/[actorId]/page.js');
  assert.match(page, /actors\/\$\{actorId\}/);
  assert.match(page, /Roles/);
  assert.match(page, /Produced/);
  assert.match(page, /Used/);
  assert.match(page, /Frontier usage/);
});

test('renders Event audit with signatures and parent hash chain', async () => {
  const page = await read('../app/events/page.js');
  assert.match(page, /events\?limit=100/);
  assert.match(page, /Hash/);
  assert.match(page, /Signature/);
  assert.match(page, /Parents/);
  assert.match(page, /ResearchEvents/);
});

test('provides project SSE client with reconnect handling', async () => {
  const component = await read('../components/project-event-stream.js');
  const page = await read('../app/projects/[projectId]/page.js');
  assert.match(component, /new EventSource/);
  assert.match(component, /events\/stream/);
  assert.match(component, /reconnecting/);
  assert.match(component, /source\.close/);
  assert.match(page, /ProjectEventStream/);
});
