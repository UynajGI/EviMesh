import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertContributionRole,
  contributionRoleSemantics,
  CONTRIBUTION_ROLES,
  isContributionRole,
} from '../src/contribution-role.mjs';

test('defines Contribution roles from originator through maintainer', () => {
  assert.deepEqual(CONTRIBUTION_ROLES, [
    'originator', 'contributor', 'reviewer', 'verifier', 'witness', 'maintainer',
  ]);
  assert.equal(Object.isFrozen(CONTRIBUTION_ROLES), true);
  CONTRIBUTION_ROLES.forEach((role) => {
    assert.equal(assertContributionRole(role), role);
    assert.match(contributionRoleSemantics(role), /^(created|made|reviewed|performed|attested|maintains)/);
  });
});

test('rejects unsupported Contribution roles', () => {
  assert.equal(isContributionRole('sponsor'), false);
  assert.equal(isContributionRole(null), false);
  assert.throws(() => assertContributionRole('sponsor'), /unsupported contribution role/);
  assert.throws(() => contributionRoleSemantics(undefined), /unsupported contribution role/);
});
