import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shell = await readFile(new URL('../components/template-shell.js', import.meta.url), 'utf8');

test('TailAdmin shell groups research navigation by user purpose', () => {
  assert.match(shell, /label: 'Workspace'/);
  assert.match(shell, /label: 'Connect'/);
  for (const label of ['Overview', 'Projects', 'Questions', 'Claims', 'Tasks', 'Verification', 'Agent manual', 'API tokens', 'Activity']) {
    assert.match(shell, new RegExp(`label: '${label}'`), `navigation is missing ${label}`);
  }
});

test('header exposes Login and Agent manual without hiding them in overflow', () => {
  assert.match(shell, /href="\/login"/);
  assert.match(shell, />Login<\/Link>/);
  assert.match(shell, /href="\/agent"/);
});

test('mobile navigation uses an accessible drawer and backdrop', () => {
  assert.match(shell, /aria-label="Open navigation"/);
  assert.match(shell, /aria-label="Close navigation"/);
  assert.match(shell, /mobileOpen \? 'translate-x-0'/);
  assert.match(shell, /bg-slate-900\/50 backdrop-blur-sm/);
});
