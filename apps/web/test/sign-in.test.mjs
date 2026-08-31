import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const login = await readFile(new URL('../app/login/page.js', import.meta.url), 'utf8');
const orcidProvider = await readFile(new URL('../lib/orcid-provider.js', import.meta.url), 'utf8');
const legacy = await readFile(new URL('../app/sign-in/page.js', import.meta.url), 'utf8');

test('login renders provider buttons from the live auth configuration', () => {
  // The button set follows /auth/v1/settings: never advertises a provider
  // the backend would reject, and ORCID appears the moment it is enabled.
  assert.match(login, /auth\/v1\/settings/);
  assert.match(login, /settings\?\.external/);
  assert.match(login, /google: 'Google'/);
  // Unknown enabled providers still render generically, never filtered out.
  assert.match(login, /PROVIDER_LABELS\[provider\] \?\? provider\.charAt\(0\)\.toUpperCase\(\) \+ provider\.slice\(1\)/);
  // Official brand marks, not generic lucide stand-ins (design book 06).
  assert.match(login, /github: GithubMark, orcid: OrcidMark, google: GoogleMark/);
  assert.match(login, /brand-marks/);
  assert.doesNotMatch(login, /GitFork|Fingerprint/);
  assert.match(login, /providerButtons/);
  assert.match(login, /signInWithOAuth\(\{ provider, /);
  assert.match(login, /ORCID_PROVIDER_CONFIGURED/);
  assert.match(login, /enabled\.unshift\(ORCID_PROVIDER\)/);
  assert.match(login, /No external provider is enabled/);
});

test('login keeps ORCID visible when production has not enabled its OAuth provider', () => {
  // ORCID is a first-class research identity even when Supabase has no
  // built-in provider entry yet. The UI must show the honest setup state and
  // a handoff to Settings instead of rendering a dead OAuth button.
  assert.match(login, /isOrcidProvider/);
  assert.match(orcidProvider, /startsWith\('custom:orcid'\)/);
  assert.match(login, /ORCID research identity/);
  assert.match(login, /Not enabled in this workspace/);
  assert.match(login, /Sign in with email, then connect ORCID/);
  assert.match(login, /aria-label="ORCID identity status"/);
});

test('login offers magic link, password, and account creation', () => {
  assert.match(login, /signInWithOtp/);
  assert.match(login, /Email me a sign-in link/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /auth\.signUp/);
  assert.match(login, /Create account/);
  assert.match(login, /New to EviMesh?/);
  assert.match(login, /Create an account →/);
  assert.match(login, /disabled=\{pending !== null\}/);
});

test('login keeps only functional copy, no policy chatter', () => {
  assert.match(login, /role="alert"/);
  // The ORCID/identity explainer and the Supabase footer are gone.
  assert.doesNotMatch(login, /Research identity is separate from login/);
  assert.doesNotMatch(login, /never stores your password/);
  assert.doesNotMatch(login, /manually typed iD/);
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
