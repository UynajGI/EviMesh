import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('My Agents creates, lists and retires owned Agents through the admission client', async () => {
  const page = await read('../app/agents/page.js');
  assert.match(page, /client\.managedAgents\.list\(\)/);
  assert.match(page, /client\.managedAgents\.create\(/);
  assert.match(page, /managedAgents\.retire\(agentActorId, reason\)/);
  assert.match(page, /AdmissionSessionBoundary returnTo="\/agents"/);
  assert.match(page, /no signing key/i, 'the page states that Agents never sign');
  assert.match(page, /returnTo/, 'device approval can resume after creating an Agent');
});

test('My projects submits canonical applications and answers invitations', async () => {
  const page = await read('../app/projects/mine/page.js');
  assert.match(page, /canonicalId\('project'\)/);
  assert.match(page, /projectApplications\.submit\(/);
  assert.match(page, /projectApplications\.list\('mine'\)/);
  assert.match(page, /projectApplications\.withdraw\(/);
  assert.match(page, /projectInvitations\.mine\(\)/);
  assert.match(page, /projectInvitations\.respond\(invitationId, response\)/);
});

test('Steward review requires a written reason for every decision', async () => {
  const page = await read('../app/steward/page.js');
  assert.match(page, /projectApplications\.list\('pending'\)/);
  assert.match(page, /projectApplications\.decide\(item\.applicationId, \{ decision, reason: reason\.trim\(\) \}\)/);
  assert.match(page, /reason\.trim\(\)\.length < 10/);
  assert.match(page, /'approved'/);
  assert.match(page, /'rejected'/);
});

test('Project Members shows Agents under their owner and gates management by role', async () => {
  const [members, project] = await Promise.all([read('../components/project-members.js'), read('../app/projects/[projectId]/page.js')]);
  assert.match(members, /\/projects\/\$\{encodeURIComponent\(projectId\)\}\/members/);
  assert.match(members, /agentsByOwner/);
  assert.match(members, /projectAgents\.enroll\(projectId, choice\)/);
  assert.match(members, /projectInvitations\.create\(projectId, \{ invitedActorId: target, role, expiresAt \}\)/);
  assert.match(members, /projectInvitations\.revoke\(/);
  assert.match(members, /viewerRole === 'owner' \|\| viewerRole === 'maintainer'/);
  assert.match(members, /Invite people only/);
  assert.match(project, /'Members'/);
  assert.match(project, /<ProjectMembers projectId=\{projectId\} \/>/);
});

test('governance pages and the shell link each other', async () => {
  const [shell, device, client] = await Promise.all([read('../components/template-shell.js'), read('../app/device/page.js'), read('../lib/admission-client.mjs')]);
  for (const href of ['/agents', '/projects/mine', '/steward']) assert.ok(shell.includes(`'${href}'`), `shell is missing ${href}`);
  assert.match(shell, /actorType \?\? null/);
  assert.match(device, /\/agents\?returnTo=/);
  assert.match(client, /me: \(\) => request\('\/auth\/me'\)/);
});
