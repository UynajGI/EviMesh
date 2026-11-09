/*
 * End-to-end write loop against the Docker-free local stack
 * (node scripts/local-stack.mjs must be running on a freshly reset DB).
 *
 *   node scripts/local-e2e-loop.mjs
 *
 * Exercises, over real HTTP, every hop a person and their Agent take:
 *   1. two people sign up with email + password, confirm by the emailed link,
 *      bootstrap their actor and finish onboarding;
 *   2. Lin creates an Agent, approves a device code for it (the Agent's CLI
 *      receives a scoped token), and registers her local signing key;
 *   3. a steward approves Lin's project application (platform-signed event);
 *   4. Lin enrolls her Agent, the Agent prepares a Question and a Claim, Lin
 *      signs the canonical bytes locally, the Agent relays the signatures;
 *   5. the Question, Claim and their graph appear through the public reads;
 *   6. Chen (a second person) watches the claim, connects his own Agent, and
 *      publishes a signed Evaluation and a Rebuttal against Lin's Claim;
 *   7. Lin's Home inputs (watched objects + events) show what changed.
 *
 * Private keys are generated in memory here and never sent anywhere; only
 * the public key and Ed25519 signatures cross the wire, exactly as in sq.
 */
import { generateKeyPairSync, randomBytes, randomUUID, sign as edSign, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { canonicalJson } from '../packages/protocol/src/hash.mjs';
import { LOCAL } from './local-stack-config.mjs';

const API = `http://127.0.0.1:${LOCAL.ports.api}`;
const GATEWAY = LOCAL.gateway;
const ANON = LOCAL.keys().anon;
const run = randomBytes(3).toString('hex');
const results = [];

function step(name) {
  console.log(`\n== ${name}`);
}
function ok(label, detail = '') {
  results.push({ label, ok: true });
  console.log(`  ok   ${label}${detail ? `  ${detail}` : ''}`);
}
function fail(label, detail) {
  results.push({ label, ok: false });
  console.log(`  FAIL ${label}  ${detail}`);
  throw new Error(`${label}: ${detail}`);
}

async function http(method, url, { token = null, apikey = null, body } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (apikey) headers.apikey = apikey;
  const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: response.status, json, headers: response.headers };
}

async function expect(label, promise, statuses = [200, 201]) {
  const result = await promise;
  if (!statuses.includes(result.status)) fail(label, `HTTP ${result.status} ${JSON.stringify(result.json).slice(0, 400)}`);
  ok(label);
  return result.json;
}

const api = (method, path, options) => http(method, `${API}${path}`, options);
const auth = (method, path, options) => http(method, `${GATEWAY}/auth/v1${path}`, { apikey: ANON, ...options });

/* ----------------------------------------------------------- people -- */
async function signUp(name) {
  const email = `${name}.${run}@example.test`;
  const password = `pw-${randomBytes(9).toString('base64url')}`;
  await expect(`${name}: sign up`, auth('POST', '/signup', { body: { email, password } }));
  let link = null;
  for (let attempt = 0; attempt < 20 && !link; attempt += 1) {
    const inbox = (await http('GET', `${GATEWAY}/_mail.json`)).json ?? [];
    link = inbox.find((message) => message.to.includes(email))?.links.find((href) => href.includes('/verify'));
    if (!link) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!link) fail(`${name}: confirmation email`, 'no link in local inbox');
  const confirm = await http('GET', link);
  if (![200, 303, 302].includes(confirm.status)) fail(`${name}: confirm email`, `HTTP ${confirm.status}`);
  ok(`${name}: confirm email by link`);
  const session = await expect(`${name}: password sign-in`, auth('POST', '/token?grant_type=password', { body: { email, password } }));
  const token = session.access_token;
  const self = await expect(`${name}: bootstrap actor`, api('POST', '/actors/self', { token }));
  const actorId = self.actor?.actorId ?? self.actorId;
  await expect(`${name}: onboarding`, api('POST', '/onboarding/complete', { token, body: { termsVersion: '2026-08-01', displayName: name[0].toUpperCase() + name.slice(1) } }));
  return { name, email, token, actorId };
}

function signingKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'jwk' }).x;
  const spki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64url');
  const keyId = `key_${createHash('sha256').update(spki).digest('hex').slice(0, 32)}`;
  return { keyId, publicKey: spki, raw, privateKey };
}

async function registerKey(person) {
  person.key = signingKey();
  await expect(`${person.name}: register public signing key`, api('POST', '/signing-keys', { token: person.token, body: { keyId: person.key.keyId, publicKey: person.key.publicKey } }));
}

/* Human-local signing: exactly what `sq research sign` does. */
function humanSign(person, prepared) {
  const bytes = Buffer.from(prepared.signingBytes, 'utf8');
  const signature = edSign(null, bytes, person.key.privateKey).toString('base64url');
  return {
    schema: 'srp.client-signature-envelope.v1',
    event_type: prepared.eventType,
    payload: prepared.payload,
    nonce: prepared.nonce,
    signing_bytes_hash: prepared.signingBytesHash,
    signature: { algorithm: 'Ed25519', key_id: person.key.keyId, value: signature },
  };
}

async function connectAgent(person, agentName) {
  const agent = await expect(`${person.name}: create Agent "${agentName}"`, api('POST', '/actors/managed', { token: person.token, body: { displayName: agentName, modelName: 'local-test-model', runtime: 'sq-cli' } }));
  const device = await expect(`${agentName}: start device authorization`, api('POST', '/auth/device', { body: { client_id: 'evimesh-cli' } }));
  const pending = await api('POST', '/auth/device/token', { body: { device_code: device.device_code } });
  if (pending.status !== 400 || pending.json?.error !== 'authorization_pending') fail(`${agentName}: token is pending before approval`, JSON.stringify(pending.json));
  ok(`${agentName}: token stays pending until a human approves`);
  await expect(`${person.name}: preview device code`, api('GET', `/auth/device/grants/${device.user_code}`, { token: person.token }));
  await expect(`${person.name}: approve device code for Agent`, api('POST', '/auth/device/approve', { token: person.token, body: { user_code: device.user_code, agent_actor_id: agent.actorId } }));
  const issued = await expect(`${agentName}: exchange device code for token`, api('POST', '/auth/device/token', { body: { device_code: device.device_code } }));
  const replay = await api('POST', '/auth/device/token', { body: { device_code: device.device_code } });
  if (replay.status < 400) fail(`${agentName}: device code is single-use`, `HTTP ${replay.status}`);
  ok(`${agentName}: device code is single-use`);
  return { actorId: agent.actorId, token: issued.access_token, name: agentName, owner: person };
}

/* ------------------------------------------------------------- run -- */
step('1. Two people sign up, confirm email, onboard');
const lin = await signUp('lin');
const chen = await signUp('chen');
const steward = await signUp('steward');

step('2. Lin connects an Agent and registers her signing key');
const atlas = await connectAgent(lin, 'atlas');
await registerKey(lin);
const meAsAgent = await expect('atlas: /auth/me with Agent token', api('GET', '/auth/me', { token: atlas.token }));
if (meAsAgent.actorType !== 'agent') fail('atlas: token is bound to the Agent actor', JSON.stringify(meAsAgent));
ok('atlas: token is bound to the Agent, not to Lin');
const forbidden = await api('POST', '/signing-keys', { token: atlas.token, body: { keyId: 'x', publicKey: 'y' } });
if (forbidden.status < 400) fail('atlas: Agent cannot register signing keys', `HTTP ${forbidden.status}`);
ok('atlas: Agent cannot touch account keys');

step('3. Project: Lin applies, a steward approves (platform-signed)');
const projectId = `project_${randomUUID()}`;
const application = await expect('lin: submit project application', api('POST', '/project-applications', { token: lin.token, body: { proposedProjectId: projectId, name: `Contrastive reproducibility ${run}`, summary: 'Blind reproductions of contrastive few-shot gains.', license: 'CC-BY-4.0' } }));
const applicationId = application.applicationId ?? application.application_id;
const mine = await expect('lin: list my applications', api('GET', '/project-applications?scope=mine', { token: lin.token }));
if (!mine.items.some((item) => item.applicationId === applicationId)) fail('lin: application listed', JSON.stringify(mine));
// Local stand-in for the community steward role (granted operationally, never self-served).
const psql = join(LOCAL.pgBin, 'psql.exe');
spawnSync(psql, ['-h', '127.0.0.1', '-p', String(LOCAL.pgPort), '-U', 'postgres', '-d', LOCAL.db, '-c', `UPDATE public.actors SET actor_type='maintainer' WHERE actor_id='${steward.actorId}'`], { windowsHide: true });
const notSteward = await api('GET', '/project-applications?scope=pending', { token: chen.token });
if (notSteward.status < 400) fail('non-steward cannot read the pending queue', `HTTP ${notSteward.status}`);
ok('a regular person cannot read the steward queue');
const pendingQueue = await expect('steward: list pending applications', api('GET', '/project-applications?scope=pending', { token: steward.token }));
if (!pendingQueue.items.some((item) => item.applicationId === applicationId)) fail('steward: sees pending application', JSON.stringify(pendingQueue));
const decision = await expect('steward: approve application', api('POST', `/project-applications/${applicationId}/decision`, { token: steward.token, body: { decision: 'approved', reason: 'Clear scope and falsification criteria.' } }));
if (decision.status !== 'approved' || decision.projectId !== projectId) fail('project created', JSON.stringify(decision));
await expect('public: project is readable', api('GET', `/projects/${projectId}`));

step('4. Agent drafts, Lin signs locally, Agent relays');
await expect('lin: enroll atlas in project', api('POST', `/projects/${projectId}/agents`, { token: lin.token, body: { agentActorId: atlas.actorId } }));
const questionId = `question_${randomUUID()}`;
const questionInput = {
  questionId, projectId, revision: 1, state: 'active',
  title: 'Do contrastive few-shot gains survive blind reproduction?',
  statement: 'Independent reruns of published contrastive few-shot results under a frozen evaluation harness.',
  topics: ['contrastive-learning', 'reproducibility'],
  researchContract: {
    problem: 'Published few-shot gains lack independent blind reproductions.',
    scope: ['SimCLR-style pretraining', 'MoCo v2 baseline'],
    falsification: ['Matched reruns miss reported accuracy by more than 2 points on 3 of 4 benchmarks.'],
    acceptable_evidence: ['blind replication with a frozen harness'],
  },
  nonce: randomBytes(18).toString('base64url'),
};
const preparedQuestion = await expect('atlas: prepare question', api('POST', '/research/questions/prepare', { token: atlas.token, body: questionInput }));
if (preparedQuestion.payload.publisherActorId !== lin.actorId || preparedQuestion.payload.producerActorId !== atlas.actorId) fail('prepared attribution', JSON.stringify(preparedQuestion.payload).slice(0, 300));
ok('prepared bytes bind atlas as producer and Lin as publisher/signer');
const unsigned = await api('POST', '/research/questions', { token: atlas.token, body: questionInput });
if (unsigned.status !== 400) fail('submit without a human signature is rejected', `HTTP ${unsigned.status}`);
ok('submit without a human signature is rejected');
const questionEnvelope = humanSign(lin, preparedQuestion);
const tampered = structuredClone(questionEnvelope);
tampered.payload.node.title = 'A different title the human never saw';
const tamperedResult = await api('POST', '/research/questions', { token: atlas.token, body: { ...questionInput, title: tampered.payload.node.title, signatureEnvelope: tampered } });
if (tamperedResult.status < 400) fail('tampered content is rejected', `HTTP ${tamperedResult.status}`);
ok('content changed after signing is rejected');
const questionReceipt = await expect('atlas: relay signed question', api('POST', '/research/questions', { token: atlas.token, body: { ...questionInput, signatureEnvelope: questionEnvelope } }));
const replayResult = await api('POST', '/research/questions', { token: atlas.token, body: { ...questionInput, signatureEnvelope: questionEnvelope } });
if (replayResult.status >= 400 || replayResult.json?.receiptId !== questionReceipt.receiptId) fail('identical retry is idempotent', `HTTP ${replayResult.status}`);
ok('identical retry returns the same receipt');

const claimId = `claim_${randomUUID()}`;
const claimInput = {
  claimId, projectId, revision: 1, questionId,
  statement: 'SimCLR-style pretraining narrows the few-shot gap to within 1.0 point of supervised baselines when protocols are matched.',
  scope: ['four benchmarks', 'k <= 16 labelled samples per class'],
  assumptions: ['evaluation harness frozen before reruns'],
  falsification: ['Matched reruns miss the reported gap by more than 2 points on 3 of 4 benchmarks.'],
  relations: [],
  nonce: randomBytes(18).toString('base64url'),
};
const preparedClaim = await expect('atlas: prepare claim', api('POST', '/research/claims/prepare', { token: atlas.token, body: claimInput }));
await expect('atlas: relay signed claim', api('POST', '/research/claims', { token: atlas.token, body: { ...claimInput, signatureEnvelope: humanSign(lin, preparedClaim) } }));

step('5. Workspace and graph read back');
const question = await expect('public: question detail', api('GET', `/questions/${questionId}`));
const claim = await expect('public: claim detail', api('GET', `/claims/${claimId}`));
if ((claim.claim?.state ?? claim.state) !== 'hypothesis') fail('claim starts as hypothesis', JSON.stringify(claim).slice(0, 200));
ok('claim starts as hypothesis; no score anywhere', `question "${question.currentRevision?.title ?? question.question?.title ?? '?'}"`);
const neighborhood = await expect('public: research neighborhood around the claim', api('GET', `/research-graph/claim/${claimId}/neighborhood?direction=both&depth=2`), [200]);
const nodeKinds = new Set((neighborhood.nodes ?? []).map((node) => node.ref?.kind ?? node.kind));
console.log(`       graph nodes: ${[...nodeKinds].join(', ') || '(none)'}`);
const events = await expect('public: claim activity', api('GET', `/events?objectType=claim&objectId=${claimId}`));
if (!(events.items ?? events.events ?? []).length) fail('claim has a signed event', JSON.stringify(events).slice(0, 200));
ok('claim activity shows the signed event');

step('6. Lin watches her claim; Chen connects his Agent, evaluates and rebuts');
await expect('lin: watch the claim', api('PUT', `/interactions/claim/${claimId}`, { token: lin.token, body: { kind: 'watch' } }));
const witness = await connectAgent(chen, 'witness');
await registerKey(chen);
// Chen joins the project as a contributor through an invitation from Lin.
const invitation = await expect('lin: invite chen as contributor', api('POST', `/projects/${projectId}/invitations`, { token: lin.token, body: { invitedActorId: chen.actorId, role: 'contributor', expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString() } }));
await expect('chen: accept invitation', api('POST', `/project-invitations/${invitation.invitation_id ?? invitation.invitationId}/respond`, { token: chen.token, body: { response: 'accepted' } }));
await expect('chen: enroll witness in project', api('POST', `/projects/${projectId}/agents`, { token: chen.token, body: { agentActorId: witness.actorId } }));
const claimRef = { kind: 'claim', id: claimId, revision: 1 };
const evaluationInput = {
  evaluationId: `evaluation_${randomUUID()}`, projectId, revision: 1, state: 'published',
  subjectRef: claimRef, basisRefs: [claimRef], stance: 'qualifies',
  rationale: 'The gap holds on three benchmarks but widens on the fourth under prompt variation.',
  method: 'Blind rerun with six prompt variants.', nonce: randomBytes(18).toString('base64url'),
};
const preparedEvaluation = await expect('witness: prepare evaluation', api('POST', '/evaluations/prepare', { token: witness.token, body: evaluationInput }));
await expect('witness: relay chen-signed evaluation', api('POST', '/evaluations', { token: witness.token, body: { ...evaluationInput, signatureEnvelope: humanSign(chen, preparedEvaluation) } }));
const rebuttalInput = {
  rebuttalId: `rebuttal_${randomUUID()}`, projectId, revision: 1, state: 'published',
  title: 'The fourth benchmark breaks the matched-protocol claim',
  argument: 'Under four of six prompt variants the gain disappears, which the claim scope does not exclude.',
  scope: ['benchmark 4'], targetRef: claimRef, basisRefs: [claimRef], nonce: randomBytes(18).toString('base64url'),
};
const preparedRebuttal = await expect('witness: prepare rebuttal', api('POST', '/rebuttals/prepare', { token: witness.token, body: rebuttalInput }));
await expect('witness: relay chen-signed rebuttal', api('POST', '/rebuttals', { token: witness.token, body: { ...rebuttalInput, signatureEnvelope: humanSign(chen, preparedRebuttal) } }));
const crossSign = await api('POST', '/rebuttals', { token: witness.token, body: { ...rebuttalInput, rebuttalId: `rebuttal_${randomUUID()}`, signatureEnvelope: humanSign(lin, preparedRebuttal) } });
if (crossSign.status < 400) fail('an Agent cannot relay someone else\'s signature', `HTTP ${crossSign.status}`);
ok('witness cannot relay a signature from a person who does not own it');

step('7. Lin sees what changed');
const watched = await expect('lin: watched objects', api('GET', '/interactions/mine?kind=watch', { token: lin.token }));
if (!(watched.interactions ?? []).some((item) => item.objectId === claimId)) fail('claim is on Lin\'s watchlist', JSON.stringify(watched));
const after = await expect('lin: claim activity now', api('GET', `/events?objectType=claim&objectId=${claimId}&order=desc`));
const afterTypes = new Set((after.items ?? []).map((event) => event.eventType));
for (const type of ['evaluation.created', 'rebuttal.created']) {
  if (!afterTypes.has(type)) fail(`Home feed for the watched claim includes ${type}`, [...afterTypes].join(','));
  ok(`Home feed for the watched claim includes ${type}`);
}
const graphAfter = await expect('public: neighborhood after challenge', api('GET', `/research-graph/claim/${claimId}/neighborhood?direction=both&depth=1`));
const kindsAfter = new Set((graphAfter.nodes ?? []).map((node) => node.ref?.kind ?? node.kind));
for (const kind of ['evaluation', 'rebuttal']) {
  if (!kindsAfter.has(kind)) fail(`graph shows the new ${kind}`, [...kindsAfter].join(','));
  ok(`graph shows the new ${kind} next to the claim`);
}
console.log(`       claim events: ${(after.items ?? after.events ?? []).length}`);

const passed = results.filter((item) => item.ok).length;
console.log(`\n${passed}/${results.length} checks passed. Project ${projectId}, claim ${claimId}`);
console.log(JSON.stringify({ projectId, questionId, claimId, lin: lin.email, chen: chen.email }));
