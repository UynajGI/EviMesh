// Run against the local web server configured with the .test URLs in
// docs/auth-email.md. All auth/API responses are intercepted in the browser;
// this suite never creates an account or sends a confirmation email.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

const WEB = process.env.EVIMESH_AUTH_WEB_URL ?? 'http://127.0.0.1:3107';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(WEB).hostname), 'Use a local test server.');
const AUTH = 'https://auth.evimesh.test';
const API = 'https://api.evimesh.test';
const STORAGE_KEY = 'sb-auth-auth-token';
const email = 'researcher@example.test';
const password = 'local-test-password';
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated', role: 'authenticated', email,
  email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {}, identities: [], created_at: '2026-01-01T00:00:00Z',
};

function session(expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, aud: 'authenticated' })}.test-signature`,
    refresh_token: 'local-test-refresh-token', token_type: 'bearer',
    expires_in: 3600, expires_at: expiresAt, user,
  };
}

let browser;
before(async () => {
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
});
after(async () => { await browser?.close(); });

async function fixture(t, { confirmation = false, rejectPassword = false, refreshError = false, storedSession, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
  t.after(() => context.close());
  const requests = [];
  const errors = [];
  context.on('page', (page) => {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.text().includes('Multiple GoTrueClient instances')) errors.push(message.text());
    });
  });
  const assertNoErrors = () => assert.deepEqual(errors, [], 'No runtime errors or duplicate auth clients');
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(WEB).origin) return route.continue();
    const json = (payload, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
    if (url.origin === AUTH) {
      requests.push({ path: url.pathname, query: url.searchParams, body: request.postDataJSON() });
      if (url.pathname.endsWith('/settings')) return json({ external: { email: true, github: true } });
      if (url.pathname.endsWith('/signup')) return json(confirmation ? { ...user, email_confirmed_at: undefined } : session());
      if (url.pathname.endsWith('/otp')) return json({});
      if (url.pathname.endsWith('/user')) return json(user);
      if (url.pathname.endsWith('/token')) {
        if (rejectPassword && url.searchParams.get('grant_type') === 'password') return json({ msg: 'Invalid login credentials', error_code: 'invalid_credentials' }, 400);
        if (refreshError && url.searchParams.get('grant_type') === 'refresh_token') return json({ msg: 'Refresh token expired', error_code: 'refresh_token_not_found' }, 400);
        return json(session());
      }
      if (url.pathname.endsWith('/authorize')) {
        const redirectTo = url.searchParams.get('redirect_to');
        if (!redirectTo || !URL.canParse(redirectTo) || new URL(redirectTo).origin !== new URL(WEB).origin) {
          errors.push('OAuth /authorize must include a valid local redirect_to URL');
          return json({ msg: 'Invalid OAuth redirect_to' }, 400);
        }
        const destination = new URL(redirectTo);
        destination.hash = new URLSearchParams({ ...session(), user: '', type: 'signup' }).toString();
        return route.fulfill({ status: 302, headers: { location: destination.toString() } });
      }
      return json({ msg: 'Unexpected auth endpoint' }, 404);
    }
    if (url.origin === API) {
      if (url.pathname === '/profile') return json({ displayName: 'Test researcher', bio: '', avatarUrl: '' });
      return json({ interactions: [], items: [], tokens: [], recommendations: [] });
    }
    // Do not allow a misconfigured test build to send test credentials outside
    // the local server and these intercepted hosts.
    return route.abort();
  });
  if (storedSession) {
    await context.addInitScript(({ key, value, origin }) => {
      if (window.location.origin !== origin) return;
      if (!sessionStorage.getItem('auth-fixture-seeded')) {
        localStorage.setItem(key, JSON.stringify(value));
        sessionStorage.setItem('auth-fixture-seeded', '1');
      }
    }, { key: STORAGE_KEY, value: storedSession, origin: new URL(WEB).origin });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  return { context, page, requests, assertNoErrors };
}

const PASSWORD_LABELS = { 'Create account': 'Choose a password', Password: 'Password' };
const SUBMIT_LABELS = { 'Create account': 'Create account', Password: 'Sign in', 'Sign-in link': 'Email me a sign-in link' };

async function submit(page, mode) {
  assert.ok(Object.hasOwn(SUBMIT_LABELS, mode), `Unknown login mode: ${mode}`);
  await page.goto(`${WEB}/login`);
  await page.getByRole('tab', { name: mode, exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  if (PASSWORD_LABELS[mode]) await page.getByLabel(PASSWORD_LABELS[mode], { exact: true }).fill(password);
  await page.getByRole('button', { name: SUBMIT_LABELS[mode], exact: true }).click();
}

async function signedIn(page) {
  await page.locator('header').getByRole('link', { name: 'Account', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Sign in', exact: true }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'Sign in to load watched research' }).count(), 0);
}

test('password login updates navigation, survives refresh, and skips an already signed-in login form', async (t) => {
  const { page, requests, assertNoErrors } = await fixture(t);
  await submit(page, 'Password');
  await page.waitForURL(`${WEB}/home`);
  await signedIn(page);
  assert.equal(requests.filter(({ query }) => query.get('grant_type') === 'password').length, 1);
  await page.reload();
  await signedIn(page);
  await page.goto(`${WEB}/login`);
  await page.waitForURL(`${WEB}/home`);
  await signedIn(page);
  assertNoErrors();
});

test('signup with a returned session enters Home without asking for a second login', async (t) => {
  const { page, requests, assertNoErrors } = await fixture(t);
  await submit(page, 'Create account');
  await page.waitForURL(`${WEB}/home`);
  await signedIn(page);
  assert.equal(requests.filter(({ query }) => query.get('grant_type') === 'password').length, 0);
  assert.equal(requests.find(({ path }) => path.endsWith('/signup')).query.get('redirect_to'), `${WEB}/home`);
  assertNoErrors();
});

test('signup needing confirmation stays signed out and explains the confirmation step', async (t) => {
  const { page, assertNoErrors } = await fixture(t, { confirmation: true });
  await submit(page, 'Create account');
  await page.getByRole('alert').filter({ hasText: `Check ${email} for a confirmation link.` }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/login');
  assert.equal(await page.getByRole('tab', { name: 'Create account', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), null);
  assertNoErrors();
});

test('email links target Home and leave the sender signed out until the link is opened', async (t) => {
  const { page, requests, assertNoErrors } = await fixture(t);
  await submit(page, 'Sign-in link');
  await page.getByRole('alert').filter({ hasText: 'Sign-in link sent' }).waitFor();
  assert.equal(requests.find(({ path }) => path.endsWith('/otp')).query.get('redirect_to'), `${WEB}/home`);
  assert.equal(new URL(page.url()).pathname, '/login');
  assertNoErrors();
});

test('email confirmation callbacks recover the session on both current and older landing URLs', async (t) => {
  for (const path of ['/home', '/']) {
    const { page, assertNoErrors } = await fixture(t);
    const tokens = session();
    const hash = new URLSearchParams({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_type: tokens.token_type, expires_in: '3600', type: 'signup' });
    await page.goto(`${WEB}${path}#${hash}`);
    await signedIn(page);
    assert.equal(new URL(page.url()).hash, '');
    await page.reload();
    await signedIn(page);
    assertNoErrors();
  }
});

test('OAuth sign-in returns to an authenticated Home', async (t) => {
  const { page, requests, assertNoErrors } = await fixture(t);
  await page.goto(`${WEB}/login`);
  await page.getByRole('button', { name: 'Continue with GitHub' }).click();
  await page.waitForURL((url) => url.origin === new URL(WEB).origin && url.pathname === '/home');
  await signedIn(page);
  assert.equal(requests.find(({ path }) => path.endsWith('/authorize')).query.get('redirect_to'), `${WEB}/home`);
  assertNoErrors();
});

test('expired access tokens refresh once and keep the user signed in', async (t) => {
  const { page, requests, assertNoErrors } = await fixture(t, { storedSession: session(Math.floor(Date.now() / 1000) - 60) });
  await page.goto(`${WEB}/home`);
  await signedIn(page);
  assert.equal(requests.filter(({ query }) => query.get('grant_type') === 'refresh_token').length, 1);
  assertNoErrors();
});

test('rejected credentials keep the form usable and do not create a session', async (t) => {
  const { page, assertNoErrors } = await fixture(t, { rejectPassword: true });
  await submit(page, 'Password');
  await page.getByRole('alert').filter({ hasText: 'Invalid login credentials' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).isEnabled(), true);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), null);
  assertNoErrors();
});

test('expired refresh tokens allow a fresh login instead of trapping the loading state', async (t) => {
  const { page, assertNoErrors } = await fixture(t, { storedSession: session(Math.floor(Date.now() / 1000) - 60), refreshError: true });
  await page.goto(`${WEB}/login`);
  await page.getByRole('tab', { name: 'Password', exact: true }).waitFor();
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), null);
  assertNoErrors();
});

test('mobile navigation shows Account and tracks a sign-out from another tab', async (t) => {
  const { page, context, assertNoErrors } = await fixture(t, { mobile: true, storedSession: session() });
  await page.goto(`${WEB}/`);
  await signedIn(page);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('link', { name: 'Account', exact: true }).waitFor();
  assert.equal(await drawer.getByRole('link', { name: 'Sign in', exact: true }).count(), 0);
  const other = await context.newPage();
  await other.goto(`${WEB}/`);
  await signedIn(other);
  await other.evaluate((key) => {
    localStorage.removeItem(key);
    const channel = new BroadcastChannel(key);
    channel.postMessage({ event: 'SIGNED_OUT', session: null });
    channel.close();
  }, STORAGE_KEY);
  await drawer.getByRole('link', { name: 'Sign in', exact: true }).waitFor();
  assert.equal(await drawer.getByRole('link', { name: 'Account', exact: true }).count(), 0);
  assertNoErrors();
});
