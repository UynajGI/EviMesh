import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');

/*
 * Block-level fidelity pass (docs/design/html audit, round three). Freezes
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

test('change items carry a critical level with danger tint; home uses it', async () => {
  const [item, home] = await Promise.all([read('../components/change-item.js'), read('../app/home/page.js')]);
  assert.match(item, /critical: \{ icon: OctagonAlert/);
  assert.match(item, /status-danger-bg/);
  assert.match(home, /level="critical"/);
});

test('shell wires notifications, account, and the g-key chords', async () => {
  const shell = await read('../components/template-shell.js');
  assert.match(shell, /aria-label="Notifications"/);
  assert.match(shell, /href="\/notifications"/);
  assert.match(shell, />\n?\s*Account\n?\s*<\/Link>/);
  assert.match(shell, /const G_CHORDS = \{ h: '\/home', e: '\/explore', w: '\/work', a: '\/agent', d: '\/agent\.md' \}/);
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

test('claim dag carries the five edge-family legend', async () => {
  const dag = await read('../components/claim-dag.js');
  assert.match(dag, /DAG edge family legend/);
  for (const family of ['positive', 'negative', 'qualify', 'structural', 'lineage']) {
    assert.ok(dag.includes(`'${family}'`), `edge family legend missing ${family}`);
  }
  assert.match(dag, /--evimesh-dag-\$\{family\}/);
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

test('claim page defaults upstream, lists revisions, expands evidence, fields receipts', async () => {
  const page = await read('../app/claims/[claimId]/page.js');
  assert.match(page, /useState\('upstream'\)/);
  assert.match(page, /Upstream: what this claim depends on\./);
  assert.match(page, /setRevisionList/);
  assert.match(page, /Math\.min\(total, 8\)/);
  assert.match(page, /Compare any two revisions field by field/);
  assert.match(page, /href=\{\`\/claims\/\$\{claim\.claimId\}\/diff\`\}/);
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

test('work ships the policy alert, blocked section, verify meta, and draft CTAs', async () => {
  const work = await read('../app/work/page.js');
  assert.match(work, /How verification works here/);
  assert.match(work, /never collapse into a total score/);
  assert.match(work, /without seeing the expected outputs/);
  assert.match(work, /status=blocked&limit=6/);
  assert.match(work, /Blocked · waiting upstream/);
  assert.match(work, /unblocks when its upstream dependency resolves/);
  assert.match(work, /Review and sign/);
  assert.match(work, /not linked to a revision until signed/);
});

test('explore carries the joinable filter, summaries, and the honest count line', async () => {
  const page = await read('../app/explore/page.js');
  assert.match(page, /Open to participate/);
  assert.match(page, /\/tasks\?status=open&limit=100/);
  assert.match(page, /openTaskQuestions/);
  assert.match(page, /item\.summary/);
  assert.match(page, /of \{windowed\.length\} loaded object/);
});

test('home keeps request ids, empty-state CTAs, the denied scope card, and gated agent copy', async () => {
  const home = await read('../app/home/page.js');
  assert.match(home, /failure\.requestId = payload\.requestId/);
  assert.match(home, /requestId=\{requestId \?\? undefined\}/);
  assert.match(home, /Find research to follow/);
  assert.match(home, /Explore open research/);
  assert.match(home, /Open the Work queue/);
  assert.match(home, /DeniedState/);
  assert.match(home, /signed-in scope/);
  assert.match(home, /pending human-in-the-loop signatures appear here once web sign-in ships/);
});

test('attempt page ships the identity card, self-declaration boundary, and public output', async () => {
  const page = await read('../app/attempts/[attemptId]/page.js');
  assert.match(page, /Identity card/);
  assert.match(page, /agentRecord/);
  assert.match(page, /\/actors\/\$\{encodeURIComponent\(act\)\}/);
  assert.match(page, /self_declared · not exposed by the public API yet/);
  assert.match(page, /Self-declared, not verified/);
  assert.match(page, /never impersonate humans/);
  assert.match(page, /This agent's public output/);
  assert.match(page, /pending confirmation pauses the trail/);
});

test('contributor orcid renders the iD mark without a verified badge', async () => {
  const page = await read('../app/contributors/[actorId]/page.js');
  assert.match(page, /aria-hidden="true" className="inline-flex h-4 w-4/);
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
  assert.match(keys, /old keys stay valid for in-flight signatures until you revoke/);
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
