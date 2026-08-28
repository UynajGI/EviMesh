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
  Bell, BookOpen, Bot, Briefcase, Compass, House, LogIn, Menu, Search, UserRound, X,
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

const LANDING_NAV_ITEMS = NAV_ITEMS.filter(({ href }) => ['/explore', '/agent', '/docs'].includes(href));
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

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

function GlobalNav({ items, pathname, onNavigate }) {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          aria-current={isActive(pathname, href) ? 'page' : undefined}
          className={cn(
            'inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors xl:px-3',
            FOCUS_RING,
            isActive(pathname, href)
              ? 'bg-accent font-semibold text-accent-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          href={href}
          key={href}
          onClick={onNavigate}
        >
          <Icon aria-hidden="true" className="hidden xl:block" size={15} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function BrandLink({ onNavigate }) {
  return (
    <Link
      className={cn('inline-flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight', FOCUS_RING)}
      href="/"
      onClick={onNavigate}
    >
      <span aria-hidden="true" className="grid size-5 place-items-center rounded-sm bg-primary text-xs font-bold text-primary-foreground">E</span>
      EviMesh
    </Link>
  );
}

function ShellFooter() {
  return (
    <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>EviMesh · traceable open research network</span>
        <span className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className={cn('transition-colors hover:text-foreground', FOCUS_RING)} href="/events">Event audit</Link>
          <Link className={cn('transition-colors hover:text-foreground', FOCUS_RING)} href="/contributions">Contributions</Link>
          <Link className={cn('transition-colors hover:text-foreground', FOCUS_RING)} href="/settings">Settings</Link>
        </span>
      </div>
    </footer>
  );
}

function MobileDrawer({ isLanding, items, onClose, pathname }) {
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/40"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-card p-4">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm font-semibold">Navigation</span>
          <button
            aria-label="Close navigation"
            className={cn('inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <nav aria-label="Primary mobile" className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              aria-current={isActive(pathname, href) ? 'page' : undefined}
              className={cn(
                'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                FOCUS_RING,
                isActive(pathname, href) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              href={href}
              key={href}
              onClick={onClose}
            >
              <Icon aria-hidden="true" size={16} />
              {label}
            </Link>
          ))}
        </nav>

        {!isLanding ? (
          <div className="mt-5 grid gap-1 border-t border-border pt-4">
            <Link className={cn('flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)} href="/explore" onClick={onClose}>
              <Search aria-hidden="true" size={16} /> Search research
            </Link>
            <Link className={cn('flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)} href="/notifications" onClick={onClose}>
              <Bell aria-hidden="true" size={16} /> Notifications
            </Link>
            <Link className={cn('flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)} href="/settings" onClick={onClose}>
              <UserRound aria-hidden="true" size={16} /> Account
            </Link>
          </div>
        ) : null}

        <Link
          className={cn('mt-auto inline-flex h-10 items-center gap-3 rounded-md border border-border px-3 text-sm font-medium text-primary transition-colors hover:bg-muted', FOCUS_RING)}
          href="/login"
          onClick={onClose}
        >
          <LogIn aria-hidden="true" size={16} />
          Sign in
        </Link>
      </div>
    </div>
  );
}

export function TemplateShell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useGChords();

  if (pathname === '/login' || pathname === '/sign-in') return children;

  const close = () => setMobileOpen(false);
  const isLanding = pathname === '/';
  const visibleNavItems = isLanding ? LANDING_NAV_ITEMS : NAV_ITEMS;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href="#main-content"
      >
        Skip to main content
      </a>

      <OfflineBanner />

      <header className="sticky top-0 z-30 h-14 border-b border-border bg-background px-4 sm:px-6">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-3">
          <button
            aria-label="Open navigation"
            className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden', FOCUS_RING)}
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <Menu aria-hidden="true" size={18} />
          </button>

          <BrandLink onNavigate={close} />
          <GlobalNav items={visibleNavItems} pathname={pathname} />
          <div className="flex-1" />

          {!isLanding ? (
            <Link
              className={cn('hidden h-8 w-56 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:flex', FOCUS_RING)}
              href="/explore"
            >
              <Search aria-hidden="true" size={14} />
              <span className="truncate">Search research</span>
              <kbd className="ml-auto rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">/</kbd>
            </Link>
          ) : null}

          <ThemeToggle />

          {!isLanding ? (
            <>
              {/* No unread badge: an unread API does not exist. */}
              <Link
                aria-label="Notifications"
                className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
                href="/notifications"
              >
                <Bell aria-hidden="true" size={15} />
              </Link>
              <Link
                className={cn('hidden h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex', FOCUS_RING)}
                href="/settings"
              >
                <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">?</span>
                Account
              </Link>
            </>
          ) : null}

          <Link
            className={cn(
              'h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
              FOCUS_RING,
              isLanding
                ? 'inline-flex border border-border bg-card hover:bg-muted'
                : 'hidden bg-primary text-primary-foreground hover:bg-accent-foreground/90 sm:inline-flex',
            )}
            href="/login"
          >
            <LogIn aria-hidden="true" size={14} />
            Sign in
          </Link>
        </div>
      </header>

      {mobileOpen ? (
        <MobileDrawer isLanding={isLanding} items={visibleNavItems} onClose={close} pathname={pathname} />
      ) : null}

      <main id="main-content" className="flex-1">{children}</main>

      <CommandPalette />
      <ShellFooter />
    </div>
  );
}
