import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');

/*
 * Block-level fidelity pass (production component audit, round three). Freezes
 * the section-level and a11y contracts the subagent audit verified as gaps.
 */

test('no React hook runs after a conditional return in any page component', async () => {
  /* Regression guard for the two crash bugs this pass fixed: hooks called
   * after an early return change the hook count between renders and crash
   * React. Mechanical scan over every page.js. */
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name === 'page.js') files.push(full);
    }
  }
  await walk(root);
  assert.ok(files.length > 10, 'expected to scan the page tree');
  for (const file of files) {
    const src = await readFile(file, 'utf8');
    const lines = src.split('\n');
    let fnAt = -1;
    let earlyReturnAt = -1;
    lines.forEach((line, index) => {
      if (/^\s*(export default function|function [A-Z]|const [A-Z]\w+ = \()/.test(line)) { fnAt = index; earlyReturnAt = -1; }
      if (fnAt >= 0 && /^\s{2}if \([!\w.]/.test(line) && /return </.test(line)) earlyReturnAt = index;
      if (earlyReturnAt >= 0 && index > earlyReturnAt && /^\s{2}(use[A-Z]\w*\()/.test(line)) {
        assert.fail(`${path.relative(root, file)}:${index + 1} calls a hook after the early return at line ${earlyReturnAt + 1}`);
      }
      if (fnAt >= 0 && /^\}/.test(line) && index > fnAt + 5) { fnAt = -1; earlyReturnAt = -1; }
    });
  }
});

test('change items carry a critical level with danger tint', async () => {
  const item = await read('../components/change-item.js');
  assert.match(item, /critical: \{ icon: OctagonAlert/);
  assert.match(item, /status-danger-bg/);
});

test('shell wires notifications, account, and the g-key chords', async () => {
  const shell = await read('../components/template-shell.js');
  assert.match(shell, /aria-label="Notifications"/);
  assert.match(shell, /href="\/notifications"/);
  assert.match(shell, />\n?\s*Account\n?\s*<\/Link>/);
  assert.match(shell, /const G_CHORDS = \{ h: '\/home', e: '\/explore', w: '\/work', t: '\/tools', c: '\/contributions', a: '\/agent', d: '\/docs' \}/);
  assert.match(shell, /function useGChords/);
  assert.match(shell, /pendingG/);
});

test('handoff sheet renders the object title and a primary close button', async () => {
  const sheet = await read('../components/handoff-sheet.js');
  assert.match(sheet, /objectTitle/);
  assert.match(sheet, /Done, back to the page/);
  assert.match(sheet, /onOpenChange\?\.\(false\)/);
});

test('form groups wire aria-invalid and aria-describedby', async () => {
  const form = await read('../components/ui/form.js');
  assert.match(form, /'aria-invalid': 'true'/);
  assert.match(form, /'aria-describedby': describedBy/);
  assert.match(form, /cloneElement/);
});

test('research neighborhood carries the protocol edge-family legend', async () => {
  const dag = await read('../components/claim-dag.js');
  assert.match(dag, /EDGE_FAMILY_STYLES/);
  for (const family of ['lineage', 'reasoning', 'challenge', 'evaluation', 'resource', 'execution', 'result', 'dependency']) {
    assert.ok(dag.includes(`'${family}'`), `edge family legend missing ${family}`);
  }
  assert.match(dag, /Object\.entries\(EDGE_FAMILY_STYLES\)/);
});

test('hydration carries provenance and fielded receipt data', async () => {
  const hydrate = await read('../lib/hydrate.mjs');
  for (const field of ['artifactId', 'runId', 'description', 'createdAt']) {
    assert.ok(hydrate.includes(`detail.${field}`), `evidence hydration missing ${field}`);
  }
  for (const field of ['verificationTypes', 'contextMode', 'implementationRelation', 'dataRelation', 'modelFamily', 'sawExpectedOutputs']) {
    assert.ok(hydrate.includes(`detail.${field}`), `receipt hydration missing ${field}`);
  }
});

test('claim page defaults to a bidirectional heterogeneous neighborhood and keeps record sections', async () => {
  const page = await read('../app/claims/[claimId]/page.js');
  assert.match(page, /useState\('both'\)/);
  assert.match(page, /depth: node\.depth/);
  assert.match(page, /claimLayoutEndpoints/);
  assert.match(page, /setRevisionList/);
  assert.match(page, /Compare any two revisions field by field/);
  assert.match(page, /href=\{\`\/claims\/\$\{claim\.claimId\}\/diff\`\}/);
  assert.match(page, /<ClaimDag direction=\{direction\} focusId=\{claim\.claimId\} graph=\{dagGraph\}/);
  assert.match(page, /Evidence by relation/);
  assert.match(page, /artifact \{item\.artifactId\}/);
  assert.match(page, /Verification receipts/);
  assert.match(page, /receipt\.verificationTypes/);
  assert.match(page, /blind: expected outputs not shown/);
  assert.match(page, /Frontier membership/);
  assert.match(page, /Challenges track on the claim record/);
});

test('workspace hydrates argument statements, task titles, richer evidence, fielded receipts', async () => {
  const page = await read('../app/questions/[questionId]/page.js');
  assert.match(page, /taskTitles/);
  assert.match(page, /detail\.currentRevision\?\.title/);
  assert.match(page, /claimStatements/);
  assert.match(page, /detail\.currentRevision\?\.statement/);
  assert.match(page, /Acceptance<\/dt>/);
  assert.match(page, /Frontier contamination/);
  assert.match(page, /dependency_tainted/);
  assert.match(page, /artifact \$\{item\.artifactId\}/);
  assert.match(page, /receipt\.verificationTypes/);
  assert.match(page, /receipt\.findings/);
});

test('work ships an editorial read-only record and Agent handoff', async () => {
  const work = await read('../app/work/page.js');
  assert.match(work, /The working record/);
  assert.match(work, /OPEN ASSIGNMENTS/);
  assert.match(work, /VERIFICATION/);
  assert.match(work, /EVENT RECORD/);
  assert.match(work, /Open Agent handoff/);
  assert.doesNotMatch(work, /Review and sign|\/claims\/new|method:\s*['"]POST/);
});

test('explore carries unified object facets, summaries, and bounded ordering', async () => {
  const page = await read('../app/explore/page.js');
  for (const type of ['answer', 'rebuttal', 'evaluation', 'dataset', 'tool']) assert.ok(page.includes(`type: '${type}'`));
  assert.match(page, /Research object facets/);
  assert.match(page, /Filter by research object type/);
  assert.match(page, /item\.summary/);
  assert.match(page, /bounded responses returned by each object endpoint/);
});

test('home keeps signed-out, empty, partial, error, and honest rail states', async () => {
  const home = await read('../app/home/page.js');
  assert.match(home, /failure\.requestId = payload\.request_id \?\? payload\.requestId \?\? null/);
  assert.match(home, /requestId=\{requestId \?\? undefined\}/);
  for (const state of ['DeniedState', 'Empty', 'ErrorState', 'Alert', 'Skeleton']) assert.match(home, new RegExp(state));
  assert.match(home, /Partial watch coverage/);
  assert.match(home, /Some classification details were omitted from this bounded view/);
  assert.match(home, /No watched research yet/);
  assert.match(home, /viewer-assignment total/);
  assert.match(home, /Pending approval totals are not exposed by the API/);
  assert.match(home, /No recent local visits are stored in this browser/);
});

test('attempt page ships the identity card, self-declaration boundary, and public output', async () => {
  const page = await read('../app/attempts/[attemptId]/page.js');
  assert.match(page, /Identity card/);
  assert.match(page, /agentRecord/);
  assert.match(page, /\/actors\/\$\{encodeURIComponent\(act\)\}/);
  // Identity-card fields render from the actors endpoint; null stays honest.
  assert.match(page, /const card = agentRecord\?\.actor \?\? \{\};/);
  assert.match(page, /const actorIsAgent = card\.actorType === 'agent' \|\| card\.actorType === 'service';/);
  assert.match(page, /actorHref\(actor, actorIsAgent \? 'agent' : card\.actorType\)/);
  assert.doesNotMatch(page, /agent\|bot\|atlas\|merope/i);
  assert.match(page, /\{card\.modelName \?\? 'not stated'\}/);
  assert.match(page, /\{card\.runtime \?\? 'not stated'\}/);
  assert.match(page, /\{card\.scope \?\? 'not stated'\}/);
  assert.match(page, /\{card\.publicKeyFingerprint \?\? 'not stated'\}/);
  assert.match(page, /card\.ownerActorId/);
  assert.match(page, /Self-declared, not verified/);

  assert.match(page, /This agent's public output/);
});

test('contributor orcid renders a plain identifier without the official mark', async () => {
  const page = await read('../app/contributors/[actorId]/page.js');
  // Hard boundary (design book 06 / AGENTS.md): the official iD mark
  // requires per-iD OAuth provenance, which the actors API does not carry
  // yet - the identifier renders as a plain link and never as verified.
  assert.doesNotMatch(page, /OrcidMark/);
  assert.match(page, /orcid\.org\/\$\{actor\.orcidId\}/);
  assert.doesNotMatch(page, /<Badge[^>]*>\s*verified\s*<\/Badge>/);
  assert.match(page, /statement\.statementId/);
});

test('settings wire collision warning, token table status, rotation note, and auth boundaries', async () => {
  const [settings, tokens, keys] = await Promise.all([
    read('../app/settings/page.js'),
    read('../app/settings/tokens/page.js'),
    read('../app/settings/keys/page.js'),
  ]);
  assert.match(settings, /One iD, one account/);
  assert.match(settings, /never silently merged/);
  assert.match(tokens, /last used \{token\.lastUsedAt/);
  assert.match(tokens, /const status = revoked \? 'revoked' : expired \? 'expired' : 'active'/);
  assert.match(tokens, /Connect an agent first/);
  assert.match(tokens, /DeniedState/);
  assert.match(tokens, /Re-authentication needed/);
  assert.match(keys, /Rotation keeps old keys until revoked/);
  assert.match(keys, /old keys stay valid until revoked/);
});

test('agent center anchors its sections and marks the recommended path', async () => {
  const page = await read('../app/agent/page.js');
  assert.match(page, /id="ac-connect"/);
  assert.match(page, /id="ac-clients"/);
  assert.match(page, /id="ac-read"/);
  assert.match(page, /id="ac-security"/);
  assert.match(page, /recommended path/);
  assert.match(page, /Review or revoke tokens and scopes in Settings/);
});

/*
 * Protocol/API closure pass: topics, actor directory, identity-card fields,
 * and live grants moved from data gates to real data.
 */

test('explore is a unified research-object index with protocol type facets', async () => {
  const page = await read('../app/explore/page.js');
  for (const type of ['question', 'answer', 'claim', 'rebuttal', 'evaluation', 'evidence', 'dataset', 'tool', 'run']) {
    assert.ok(page.includes(`type: '${type}'`), `missing ${type} source`);
  }
  assert.match(page, /Filter by research object type/);
  assert.match(page, /Browse the attributable record across reasoning, resources and execution/);
  assert.match(page, /Ordered by recorded time/);
  assert.doesNotMatch(page, /Topics|Researchers|\/actors\?limit=/);
});

test('explore keeps datasets discoverable and links the Tool facet to its dedicated directory', async () => {
  const page = await read('../app/explore/page.js');
  assert.match(page, /path: '\/datasets\?limit=40'/);
  assert.match(page, /path: '\/tools\?limit=40'/);
  assert.match(page, /selectedType === 'tool'/);
  assert.match(page, /href="\/tools">Open Tool directory/);
});

test('agent page lists live grants from the signed-in session', async () => {
  const page = await read('../app/agent/page.js');
  assert.match(page, /const \[grants, setGrants\] = useState\('signed-out'\)/);
  assert.match(page, /\/api-tokens`/);
  assert.match(page, /Bearer \$\{session\.access_token\}/);
  assert.match(page, /aria-label="Active grants"/);
  assert.match(page, /adjust scope/);
  assert.match(page, /revokeGrant\(grant\)/);
  assert.match(page, /method: 'DELETE'/);
  assert.match(page, /Sign in to see your live grants/);
});

test('identity-card fields flow from the actors endpoint through the api layer', async () => {
  const [query, repo] = await Promise.all([
    read('../../api-edge/src/contribution-query.mjs'),
    read('../../api-edge/src/supabase-read-repository.mjs'),
  ]);
  for (const field of ['modelName', 'runtime', 'scope', 'publicKeyFingerprint', 'ownerActorId', 'actorType', 'identityStrength']) {
    assert.ok(query.includes(field), `contribution query missing ${field}`);
  }
  assert.match(query, /export async function listActors/);
  // Actor directory reads go through the security-invoker projection so the
  // browser never receives auth_subject or other private actor columns.
  assert.match(repo, /listActors: async \(\) => query\("actorDirectory"/);
  assert.match(repo, /getActorProfile/);
  assert.match(repo, /listContributionStatements: \(actorId\) => list\("contributionStatements"/);
  // Append-only fact tables must not get the soft-delete filter.
  assert.match(repo, /SOFT_DELETE_TABLES/);
});

test('questions carry bounded topic tags through creation', async () => {
  const [command, openapi] = await Promise.all([
    read('../../../packages/domain/src/question-command.mjs'),
    read('../../api-edge/openapi.json'),
  ]);
  assert.match(command, /const TOPIC_LIMIT = 8;/);
  assert.match(command, /const TOPIC_MAX_LENGTH = 48;/);
  assert.match(command, /topics: normalizeTopics\(topics\)/);
  assert.ok(openapi.includes('"topics"'), 'openapi must document topics');
  assert.ok(openapi.includes('ActorDirectoryResponse'), 'openapi must document the actor directory');
});

test('settings offer the ORCID OAuth connect only when the provider is enabled', async () => {
  const settings = await read('../app/settings/page.js');
  assert.match(settings, /auth\/v1\/settings/);
  assert.match(settings, /orcidEnabled/);
  assert.match(settings, /ORCID_PROVIDER_CONFIGURED/);
  assert.match(settings, /Object\.keys\(external\)\.some/);
  assert.match(settings, /linkIdentity\(\{ provider: ORCID_PROVIDER/);
  assert.match(settings, /Connect ORCID \(OAuth\)/);
  assert.match(settings, /Enable the ORCID provider to connect/);
});

test('brand marks carry the official provider marks', async () => {
  const marks = await read('../components/brand-marks.js');
  // GitHub octocat path, Google four-color G, ORCID green disc with white iD.
  assert.match(marks, /export function GithubMark/);
  assert.match(marks, /export function GoogleMark/);
  assert.match(marks, /export function OrcidMark/);
  assert.match(marks, /#4285F4/);
  assert.match(marks, /#34A853/);
  assert.match(marks, /#A6CE39/);
  assert.ok(marks.includes(">iD</text>"));
});
