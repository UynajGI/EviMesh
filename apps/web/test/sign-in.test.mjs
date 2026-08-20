import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const login = await readFile(new URL('../app/login/page.js', import.meta.url), 'utf8');
const legacy = await readFile(new URL('../app/sign-in/page.js', import.meta.url), 'utf8');

test('login renders provider buttons from the live auth configuration', () => {
  // The button set follows /auth/v1/settings: never advertises a provider
  // the backend would reject, and ORCID appears the moment it is enabled.
  assert.match(login, /auth\/v1\/settings/);
  assert.match(login, /settings\?\.external/);
  assert.match(login, /PROVIDER_LABELS = \{ github: 'GitHub', orcid: 'ORCID' \}/);
  assert.match(login, /providerButtons/);
  assert.match(login, /signInWithOAuth\(\{ provider, /);
  assert.match(login, /No external sign-in provider is enabled yet/);
});

test('login offers magic link, password, and account creation', () => {
  assert.match(login, /signInWithOtp/);
  assert.match(login, /Email me a sign-in link/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /auth\.signUp/);
  assert.match(login, /Create account/);
  assert.match(login, /disabled=\{pending !== null\}/);
});

test('login explains privacy and separates account auth from research identity', () => {
  assert.match(login, /Supabase Auth/);
  assert.match(login, /never stores your password or OAuth tokens/);
  assert.match(login, /ORCID is connected and verified from Settings via OAuth/);
  assert.match(login, /manually typed iD is never shown as verified/);
  assert.match(login, /role="alert"/);
});

test('login stays on the M13.8 token system', () => {
  assert.match(login, /TailAdmin's MIT-licensed SignInForm/);
  assert.match(login, /grid min-h-screen bg-background/);
  assert.match(login, /label className="mb-2 block text-sm font-medium" htmlFor="email"/);
  // No raw Tailwind palette classes remain.
  assert.doesNotMatch(login, /slate-[0-9]|blue-[0-9]|red-[0-9]|bg-white/);
});

test('legacy sign-in route redirects to login', () => {
  assert.match(legacy, /redirect\('\/login'\)/);
});
