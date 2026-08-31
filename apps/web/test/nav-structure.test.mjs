import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shell = await readFile(new URL('../components/template-shell.js', import.meta.url), 'utf8');
const work = await readFile(new URL('../app/work/page.js', import.meta.url), 'utf8');

test('Kinetic Journal shell uses the locked seven-destination navigation', () => {
  assert.match(shell, /const NAV_ITEMS = \[/);
  for (const item of [
    "href: '/home', label: 'Home'",
    "href: '/explore', label: 'Explore'",
    "href: '/work', label: 'Work'",
    "href: '/tools', label: 'Tools'",
    "href: '/contributions', label: 'Contributions'",
    "href: '/agent', label: 'Agent'",
    "href: '/docs', label: 'Docs'",
  ]) {
    assert.ok(shell.includes(item), `navigation is missing ${item}`);
  }
  assert.match(shell, /aria-current=\{isActive\(pathname, href\) \? 'page' : undefined\}/);
});

test('Work is a read-only record with an explicit Agent handoff', () => {
  assert.match(work, /Open Agent handoff/);
  assert.match(work, /Research authoring continues through CLI or MCP/);
  assert.doesNotMatch(work, /\/claims\/new|\/runs\/new|Review and sign|method:\s*['"]POST/);
});

test('shell exposes global search, theme toggle, and sign-in without hiding them', () => {
  assert.match(shell, /href="\/explore"/);
  assert.match(shell, /Search research/);
  assert.match(shell, /<ThemeToggle \/>/);
  assert.match(shell, /href="\/login"/);
  assert.match(shell, /Sign in/);
});

test('shell renders the approved branched mark with the two-tone wordmark', () => {
  assert.match(shell, /src="\/brand\/evimesh-mark-kinetic\.svg"/);
  assert.match(shell, /<span className="text-foreground">Evi<\/span><span className="text-primary">Mesh<\/span>/);
});

test('shell keeps the same publication inventory on every viewport', () => {
  assert.match(shell, /const isLanding = pathname === '\/'/);
  assert.match(shell, /const visibleNavItems = NAV_ITEMS/);
  assert.match(shell, /<GlobalNav items=\{visibleNavItems\}/);
  assert.match(shell, /<MobileDrawer isLanding=\{isLanding\} items=\{visibleNavItems\}/);
  for (const route of ['/explore', '/agent', '/docs', '/notifications', '/settings', '/login', '/events', '/contributions']) {
    assert.ok(shell.includes(route), `shell is missing ${route}`);
  }
  assert.match(shell, /<ShellFooter \/>/);
});

test('mobile navigation uses an accessible drawer and backdrop', () => {
  assert.match(shell, /aria-label="Open navigation"/);
  assert.match(shell, /aria-label="Close navigation"/);
  assert.match(shell, /aria-label="Primary mobile"/);
  assert.match(shell, /bg-foreground\/40/);
  assert.match(shell, /Search research/);
  assert.match(shell, /> Notifications/);
  assert.match(shell, /> Account/);
});

test('mobile drawer delegates focus management to Radix Dialog', () => {
  // Design book B08: the dialog primitive owns trap, Escape, aria, and the
  // background scroll lock; the shell must not hand-roll them.
  assert.match(shell, /<DialogPrimitive\.Root onOpenChange=\{setMobileOpen\} open=\{mobileOpen\}>/);
  assert.match(shell, /<DialogPrimitive\.Trigger asChild>/);
  assert.match(shell, /<DialogPrimitive\.Portal>/);
  assert.match(shell, /<DialogPrimitive\.Overlay className="fixed inset-0 z-40 bg-foreground\/40 md:hidden" \/>/);
  assert.match(shell, /<DialogPrimitive\.Content className="fixed inset-y-0 left-0 z-40 flex w-\[min\(22rem,88vw\)\]/);
  assert.match(shell, /<DialogPrimitive\.Title className="text-sm font-semibold">Navigation<\/DialogPrimitive\.Title>/);
  assert.match(shell, /<DialogPrimitive\.Close/);
  // Scroll lock follows dialog state while the surface is md:hidden, so an
  // open drawer must close itself when the viewport reaches the breakpoint.
  assert.match(shell, /matchMedia\('\(min-width: 768px\)'\)/);
});

test('skip link is the first focusable element of the page', () => {
  assert.match(shell, /href="#main-content"/);
  assert.match(shell, /Skip to main content/);
  assert.match(shell, /sr-only focus:not-sr-only/);
});

test('shell styling stays token-based, focus-visible, and motion restrained', () => {
  assert.match(shell, /const FOCUS_RING = 'focus-visible:/);
  assert.doesNotMatch(shell, /(?:bg|text|border)-\[\s*#/i, 'shell has no raw color utilities');
  assert.doesNotMatch(shell, /(?:from|via|to)-[a-z]/i, 'shell has no gradient utilities');
  assert.doesNotMatch(shell, /transition-(?:all|opacity|transform)/);
});
