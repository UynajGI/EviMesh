import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shell = await readFile(new URL('../components/template-shell.js', import.meta.url), 'utf8');
const work = await readFile(new URL('../app/work/page.js', import.meta.url), 'utf8');

test('M13.8 shell uses task-based primary navigation with at most five destinations', () => {
  assert.match(shell, /const NAV_ITEMS = \[/);
  for (const item of [
    "href: '/home', label: 'Home'",
    "href: '/explore', label: 'Explore'",
    "href: '/work', label: 'Work'",
    "href: '/agent', label: 'Agent'",
    "href: '/docs', label: 'Docs'",
  ]) {
    assert.ok(shell.includes(item), `navigation is missing ${item}`);
  }
  assert.match(shell, /aria-current=\{isActive\(pathname, href\) \? 'page' : undefined\}/);
});

test('shell keeps every write workflow reachable through Work, not top-level navigation', () => {
  for (const href of ['/questions/new', '/claims/new', '/runs/new', '/evidence/new', '/verification/receipt/new', '/challenges/new']) {
    assert.ok(work.includes(`href: '${href}'`), `Work page is missing ${href}`);
  }
});

test('shell exposes global search, theme toggle, and sign-in without hiding them', () => {
  assert.match(shell, /href="\/explore"/);
  assert.match(shell, /Search research/);
  assert.match(shell, /<ThemeToggle \/>/);
  assert.match(shell, /href="\/login"/);
  assert.match(shell, /Sign in/);
});

test('mobile navigation uses an accessible drawer and backdrop', () => {
  assert.match(shell, /aria-label="Open navigation"/);
  assert.match(shell, /aria-label="Close navigation"/);
  assert.match(shell, /aria-label="Primary mobile"/);
  assert.match(shell, /bg-foreground\/40/);
});

test('skip link is the first focusable element of the page', () => {
  assert.match(shell, /href="#main-content"/);
  assert.match(shell, /Skip to main content/);
  assert.match(shell, /sr-only focus:not-sr-only/);
});
