'use client';

/*
 * M13.8 product shell (docs/design/05-core-ui-spec.md): a quiet top header with
 * task-based primary navigation (Home / Explore / Work / Agent / Docs), global
 * search entry, notifications entry, manual theme toggle, G-key chords, and a
 * mobile drawer. Object routes stay reachable as Explore/Work destinations,
 * never as top-level navigation.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Bell, BookOpen, Bot, Briefcase, Compass, House, LogIn, Menu, Search, X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { CommandPalette } from '@/components/command-palette';
import { OfflineBanner } from '@/components/offline-banner';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/home', label: 'Home', icon: House },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/work', label: 'Work', icon: Briefcase },
  { href: '/agent', label: 'Agent', icon: Bot },
  { href: '/docs', label: 'Docs', icon: BookOpen },
];

/* G-key chords (mockup palette footer): g then h/e/w/a/d navigates. The
 * pending-g window is short so plain typing is never swallowed. */
const G_CHORDS = { h: '/home', e: '/explore', w: '/work', a: '/agent', d: '/agent.md' };

function useGChords() {
  const router = useRouter();
  const pendingG = useRef(false);
  useEffect(() => {
    function onKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '') || event.target?.isContentEditable;
      if (inField) { pendingG.current = false; return; }
      const key = event.key.toLowerCase();
      if (pendingG.current && G_CHORDS[key]) {
        event.preventDefault();
        pendingG.current = false;
        router.push(G_CHORDS[key]);
        return;
      }
      pendingG.current = key === 'g';
      if (pendingG.current) setTimeout(() => { pendingG.current = false; }, 900);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [router]);
}

function isActive(pathname, href) {
  if (href === '/home') return pathname === '/home' || pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function GlobalNav({ pathname, onNavigate }) {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          aria-current={isActive(pathname, href) ? 'page' : undefined}
          className={cn(
            'inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
            isActive(pathname, href)
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          href={href}
          key={href}
          onClick={onNavigate}
        >
          <Icon aria-hidden="true" size={15} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function TemplateShell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useGChords();

  if (pathname === '/login' || pathname === '/sign-in') return children;

  const close = () => setMobileOpen(false);

  /*
   * Anonymous landing header (design book 05 §1): the signed-out shell is a
   * reduced Explore / Agent / Docs nav with a quiet sign-in button, without
   * the signed-in search, notifications, and account affordances.
   */
  if (pathname === '/') {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-card focus:px-4 focus:py-2 focus:text-sm"
          href="#main-content"
        >
          Skip to main content
        </a>
        <OfflineBanner />
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-card px-4 sm:px-6">
          <Link className="inline-flex items-center gap-2 text-base font-semibold tracking-tight" href="/">
            <span aria-hidden="true" className="grid size-5 place-items-center rounded-sm bg-primary text-xs font-bold text-primary-foreground">E</span>
            EviMesh
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.filter(({ href }) => ['/explore', '/agent', '/docs'].includes(href)).map(({ href, label, icon: Icon }) => (
              <Link
                aria-current={isActive(pathname, href) ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                  isActive(pathname, href) ? 'bg-accent text-accent-foreground font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                href={href}
                key={href}
              >
                <Icon aria-hidden="true" size={15} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          <ThemeToggle />
          <Link className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted" href="/login">
            <LogIn aria-hidden="true" size={14} />
            Sign in
          </Link>
        </header>
        <main id="main-content" className="flex-1">{children}</main>
        <CommandPalette />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-card focus:px-4 focus:py-2 focus:text-sm"
        href="#main-content"
      >
        Skip to main content
      </a>

      <OfflineBanner />

      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-card px-4 sm:px-6">
        <button
          aria-label="Open navigation"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          onClick={() => setMobileOpen(true)}
          type="button"
        >
          <Menu aria-hidden="true" size={18} />
        </button>

        <Link className="inline-flex items-center gap-2 text-base font-semibold tracking-tight" href="/" onClick={close}>
          <span aria-hidden="true" className="grid size-5 place-items-center rounded-sm bg-primary text-xs font-bold text-primary-foreground">E</span>
          EviMesh
        </Link>

        <GlobalNav pathname={pathname} />

        <div className="flex-1" />

        <Link
          className="hidden h-7 w-64 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground hover:text-foreground lg:flex"
          href="/explore"
        >
          <Search aria-hidden="true" size={14} />
          <span className="truncate">Search research</span>
          <kbd className="ml-auto rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">/</kbd>
        </Link>

        <ThemeToggle />

        {/* Notifications entry (mockup gheader iconbtn). No unread badge:
            an unread API does not exist, so nothing is ever implied. */}
        <Link
          aria-label="Notifications"
          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          href="/notifications"
        >
          <Bell aria-hidden="true" size={15} />
        </Link>

        {/* Account chip: settings entry until web sign-in ships a real menu. */}
        <Link
          className="hidden h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
          href="/settings"
        >
          <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">?</span>
          Account
        </Link>

        <Link
          className="hidden h-8 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent-foreground/90 sm:inline-flex"
          href="/login"
        >
          <LogIn aria-hidden="true" size={14} />
          Sign in
        </Link>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-foreground/40" onClick={close} type="button" />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">Navigation</span>
              <button
                aria-label="Close navigation"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={close}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <nav aria-label="Primary mobile" className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  aria-current={isActive(pathname, href) ? 'page' : undefined}
                  className={cn(
                    'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium',
                    isActive(pathname, href) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  href={href}
                  key={href}
                  onClick={close}
                >
                  <Icon aria-hidden="true" size={16} />
                  {label}
                </Link>
              ))}
              <Link
                className="mt-3 inline-flex h-10 items-center gap-3 rounded-md border-t border-border px-3 text-sm font-medium text-primary hover:bg-muted"
                href="/login"
                onClick={close}
              >
                <LogIn aria-hidden="true" size={16} />
                Sign in
              </Link>
            </nav>
          </div>
        </div>
      ) : null}

      <main id="main-content" className="flex-1">{children}</main>

      <CommandPalette />

      <footer className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <span>EviMesh · traceable open research network</span>
          <span className="flex gap-4">
            <Link className="hover:text-foreground" href="/events">Event audit</Link>
            <Link className="hover:text-foreground" href="/contributions">Contributions</Link>
            <Link className="hover:text-foreground" href="/settings">Settings</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
