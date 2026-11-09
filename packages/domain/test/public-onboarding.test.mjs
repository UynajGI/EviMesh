import assert from 'node:assert/strict';
import test from 'node:test';
import { completePublicOnboarding, PublicOnboardingError } from '../src/public-onboarding.mjs';

test('persists verified-email onboarding without copying an email claim', async () => {
  let received;
  const repository = { async completeOnboarding(input) { received = input; return input; } };
  const result = await completePublicOnboarding({
    repository,
    actorId: ' actor-1 ',
    authSubject: 'auth-1',
    emailVerified: true,
    termsVersion: '2026-08-31',
    acceptedAt: '2026-08-31T00:00:00.000Z',
    displayName: 'Ada Researcher',
    bio: 'Open methods.',
  });

  assert.equal(result, received);
  assert.deepEqual(received, {
    actorId: 'actor-1',
    authSubject: 'auth-1',
    termsVersion: '2026-08-31',
    acceptedAt: '2026-08-31T00:00:00.000Z',
    displayName: 'Ada Researcher',
    bio: 'Open methods.',
    avatarUrl: null,
  });
  assert.equal('emailVerified' in received, false);
});

test('fails closed when Supabase has not verified the email', async () => {
  await assert.rejects(
    completePublicOnboarding({
      repository: { completeOnboarding: async () => assert.fail('must not persist') },
      actorId: 'actor-1',
      authSubject: 'auth-1',
      emailVerified: false,
      termsVersion: '2026-08-31',
      displayName: 'Ada',
    }),
    (error) => error instanceof PublicOnboardingError && error.code === 'EMAIL_NOT_VERIFIED' && error.status === 403,
  );
});
