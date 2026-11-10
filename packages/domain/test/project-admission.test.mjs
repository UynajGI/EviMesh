import assert from 'node:assert/strict';
import test from 'node:test';
import {
  changeProjectMembershipRole,
  createProjectInvitation,
  decideProjectApplication,
  ProjectAdmissionError,
  removeProjectMembership,
  respondToProjectInvitation,
  submitProjectApplication,
} from '../src/project-admission.mjs';

const PROJECT_ID = 'project_018f0f4a-5c00-7000-8000-000000000001';

function repository() {
  const calls = [];
  return {
    calls,
    async submitProjectApplication(input) { calls.push(['submit', input]); return input; },
    async decideProjectApplication(input) { calls.push(['decide', input]); return input; },
    async createProjectInvitation(input) { calls.push(['invite', input]); return input; },
    async respondToProjectInvitation(input) { calls.push(['respond', input]); return input; },
    async changeProjectMembershipRole(input) { calls.push(['role', input]); return input; },
    async removeProjectMembership(input) { calls.push(['remove', input]); return input; },
  };
}

test('normalizes application input and restricts decisions', async () => {
  const repo = repository();
  await submitProjectApplication({
    repository: repo,
    applicantActorId: ' actor-1 ',
    proposedProjectId: PROJECT_ID,
    name: ' Open methods ',
    summary: 'Reproduce a public result.',
    license: 'CC-BY-4.0',
    submittedAt: '2026-08-31T00:00:00Z',
  });
  assert.equal(repo.calls[0][1].applicantActorId, 'actor-1');
  assert.equal(repo.calls[0][1].name, 'Open methods');

  await assert.rejects(
    decideProjectApplication({ repository: repo, applicationId: 'a', stewardActorId: 's', decision: 'maybe', reason: 'x' }),
    (error) => error instanceof ProjectAdmissionError && error.code === 'PROJECT_ADMISSION_INVALID',
  );
  await assert.rejects(
    decideProjectApplication({ repository: repo, applicationId: 'a', stewardActorId: 's', decision: 'approved', reason: 'eligible' }),
    (error) => error instanceof ProjectAdmissionError && error.code === 'PROJECT_APPROVAL_GRAPH_WRITE_NOT_READY' && error.status === 503,
  );
  await assert.rejects(
    submitProjectApplication({
      repository: repo,
      applicantActorId: 'actor-1',
      proposedProjectId: PROJECT_ID.toUpperCase(),
      name: 'Bad id',
      summary: 'x',
      license: 'CC0',
    }),
    /canonical/,
  );
  await assert.rejects(
    submitProjectApplication({
      repository: repo,
      applicantActorId: 'actor-1',
      proposedProjectId: 'project_018f0f4a-5c00-7000-8000-000000000002',
      name: 'Long summary',
      summary: 'x'.repeat(4001),
      license: 'CC0',
    }),
    /4000/,
  );
});

test('invitation commands enforce inviter rank, invite roles, and responses', async () => {
  const repo = repository();
  const base = {
    repository: repo,
    projectId: 'project-1',
    invitedActorId: 'actor-2',
    invitedByActorId: 'actor-1',
    expiresAt: '2026-09-02T00:00:00Z',
    createdAt: '2026-08-31T00:00:00Z',
  };
  await createProjectInvitation({ ...base, inviterRole: 'maintainer', invitedRole: 'contributor' });
  assert.equal(repo.calls[0][1].role, 'contributor');

  await assert.rejects(createProjectInvitation({ ...base, inviterRole: 'viewer', invitedRole: 'contributor' }), /insufficient/);
  await assert.rejects(createProjectInvitation({ ...base, inviterRole: 'owner', invitedRole: 'owner' }), /unsupported invited role/);
  await assert.rejects(
    respondToProjectInvitation({ repository: repo, invitationId: 'invite-1', invitedActorId: 'actor-2', response: 'ignored' }),
    /accepted or declined/,
  );
});

test('membership administration requires strong roles and an audit reason', async () => {
  const repo = repository();
  await changeProjectMembershipRole({
    repository: repo,
    projectId: 'project-1',
    targetActorId: 'actor-2',
    changedByActorId: 'owner-1',
    changerRole: 'owner',
    nextRole: 'maintainer',
    reason: 'appoint steward',
  });
  await assert.rejects(
    changeProjectMembershipRole({ repository: repo, projectId: 'p', targetActorId: 't', changedByActorId: 'm', changerRole: 'maintainer', nextRole: 'viewer', reason: 'x' }),
    /insufficient/,
  );
  await assert.rejects(
    removeProjectMembership({ repository: repo, projectId: 'p', targetActorId: 't', removedByActorId: 'v', removerRole: 'viewer', reason: 'x' }),
    (error) => error instanceof ProjectAdmissionError && error.code === 'PROJECT_FORBIDDEN',
  );
});
