import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const login = await readFile(new URL('../app/login/page.js', import.meta.url), 'utf8');
const legacy = await readFile(new URL('../app/sign-in/page.js', import.meta.url), 'utf8');

test('login offers real email and GitHub authentication with pending states', () => {
  assert.match(login, /signInWithPassword/);
  assert.match(login, /signInWithOAuth\(\{ provider: 'github'/);
  assert.match(login, /Continue with GitHub/);
  assert.match(login, /disabled=\{pending\}/);
  assert.match(login, /Logging in…/);
});

test('login explains privacy and separates account auth from research identity', () => {
  assert.match(login, /Supabase Auth/);
  assert.match(login, /never stores your password/);
  assert.match(login, /ORCID will be connected and verified from your profile/);
});

test('login uses the licensed TailAdmin authentication layout', () => {
  assert.match(login, /TailAdmin's MIT-licensed SignInForm/);
  assert.match(login, /grid min-h-screen/);
  assert.match(login, /Login to your account/);
  assert.match(login, /label className=.*htmlFor="email"/);
  assert.match(login, /label className=.*htmlFor="password"/);
  assert.match(login, /role="alert"/);
});

test('legacy sign-in route redirects to login', () => {
  assert.match(legacy, /redirect\('\/login'\)/);
});
