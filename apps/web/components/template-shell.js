'use client';

/*
 * M13.8 product shell (docs/design/05-core-ui-spec.md): a quiet top header with
 * editorial primary navigation (Home / Explore / Work / Tools /
 * Contributions / Agent / Docs), global
 * search entry, notifications entry, manual theme toggle, G-key chords, and a
 * mobile drawer. Object routes stay reachable as Explore/Work destinations,
 * never as top-level navigation.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Bell, BookOpen, Bot, Briefcase, Compass, House, LogIn, Menu, Network, Search, UserRound, Wrench, X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { CommandPalette } from '@/components/command-palette';
import { OfflineBanner } from '@/components/offline-banner';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/home', label: 'Home', icon: House },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/work', label: 'Work', icon: Briefcase },
  { href: '/tools', label: 'Tools', icon: Wrench },
  { href: '/contributions', label: 'Contributions', icon: Network },
  { href: '/agent', label: 'Agent', icon: Bot },
  { href: '/docs', label: 'Docs', icon: BookOpen },
];

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/* G-key chords (mockup palette footer): g then h/e/w/a/d navigates. The
 * pending-g window is short so plain typing is never swallowed. */
const G_CHORDS = { h: '/home', e: '/explore', w: '/work', t: '/tools', c: '/contributions', a: '/agent', d: '/docs' };

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
    <nav aria-label="Primary" className="hidden h-full min-w-0 items-stretch md:flex">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          aria-current={isActive(pathname, href) ? 'page' : undefined}
          className={cn(
            'kinetic-nav-link relative inline-flex h-full min-w-0 items-center gap-2 px-1.5 text-[11px] font-semibold lg:px-2.5 xl:text-xs',
            FOCUS_RING,
            isActive(pathname, href)
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          href={href}
          key={href}
          onClick={onNavigate}
        >
          <Icon aria-hidden="true" className="hidden" size={14} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function BrandLink({ onNavigate }) {
  return (
    <Link
      className={cn('inline-flex h-full shrink-0 items-center gap-2.5 border-r border-border pr-4 text-base font-bold tracking-[-0.03em] sm:pr-6', FOCUS_RING)}
      href="/"
      onClick={onNavigate}
    >
      <img
        src="/brand/evimesh-mark-kinetic.svg"
        alt=""
        aria-hidden="true"
        className="size-7 shrink-0"
      />
      EviMesh
    </Link>
  );
}

function ShellFooter() {
  return (
    <footer className="border-t border-foreground px-[var(--evimesh-container-px)] py-7 font-mono text-[10px] text-muted-foreground">
      <div className="mx-auto grid max-w-[96rem] gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <span>EviMesh / open distributed research network</span>
        <span className="flex flex-wrap gap-x-4 gap-y-2 sm:justify-center">
          <Link className={cn('transition-colors hover:text-foreground', FOCUS_RING)} href="/events">Event audit</Link>
          <Link className={cn('transition-colors hover:text-foreground', FOCUS_RING)} href="/docs">Protocol docs</Link>
          <Link className={cn('transition-colors hover:text-foreground', FOCUS_RING)} href="/settings">Settings</Link>
        </span>
        <span className="text-primary sm:text-right">KINETIC JOURNAL / 2.1</span>
      </div>
    </footer>
  );
}

/* Mobile navigation sheet (M13.8 B08): Radix Dialog owns the focus trap,
 * Escape dismissal, aria wiring, and background scroll lock; the hand-built
 * variant only supplies the left-drawer surface. `md:hidden` keeps it a
 * mobile-only surface even while the dialog is open. */
function MobileDrawer({ isLanding, items, onClose, pathname }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/40 md:hidden" />
      <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-40 flex w-[min(22rem,88vw)] flex-col border-r border-foreground bg-background p-4 focus:outline-none md:hidden">
        <div className="mb-6 flex items-center justify-between">
          <DialogPrimitive.Title className="text-sm font-semibold">Navigation</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close navigation"
            className={cn('inline-flex size-11 items-center justify-center rounded-[1px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
          >
            <X aria-hidden="true" size={18} />
          </DialogPrimitive.Close>
        </div>

        <nav aria-label="Primary mobile" className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              aria-current={isActive(pathname, href) ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-[1px] border-b border-border px-3 text-sm font-medium transition-colors',
                FOCUS_RING,
                isActive(pathname, href) ? 'border-l-2 border-l-primary text-foreground' : 'text-muted-foreground hover:text-foreground',
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
            <Link className={cn('flex h-11 items-center gap-3 rounded-[1px] px-3 text-sm text-muted-foreground transition-colors hover:text-foreground', FOCUS_RING)} href="/explore" onClick={onClose}>
              <Search aria-hidden="true" size={16} /> Search research
            </Link>
            <Link className={cn('flex h-11 items-center gap-3 rounded-[1px] px-3 text-sm text-muted-foreground transition-colors hover:text-foreground', FOCUS_RING)} href="/notifications" onClick={onClose}>
              <Bell aria-hidden="true" size={16} /> Notifications
            </Link>
            <Link className={cn('flex h-11 items-center gap-3 rounded-[1px] px-3 text-sm text-muted-foreground transition-colors hover:text-foreground', FOCUS_RING)} href="/settings" onClick={onClose}>
              <UserRound aria-hidden="true" size={16} /> Account
            </Link>
          </div>
        ) : null}

        <Link
          className={cn('mt-auto inline-flex h-11 items-center gap-3 rounded-[1px] border border-foreground px-3 text-sm font-medium text-primary transition-colors hover:bg-foreground hover:text-background', FOCUS_RING)}
          href="/login"
          onClick={onClose}
        >
          <LogIn aria-hidden="true" size={16} />
          Sign in
        </Link>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function TemplateShell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useGChords();

  /* The drawer surface is md:hidden, but Radix's scroll lock follows the
   * dialog state, so a drawer left open across a resize would lock desktop
   * scrolling; close it when the viewport reaches the md breakpoint. */
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const desktop = window.matchMedia('(min-width: 768px)');
    const onDesktop = (event) => { if (event.matches) setMobileOpen(false); };
    desktop.addEventListener('change', onDesktop);
    return () => desktop.removeEventListener('change', onDesktop);
  }, [mobileOpen]);

  if (pathname === '/login' || pathname === '/sign-in') return children;

  const close = () => setMobileOpen(false);
  const isLanding = pathname === '/';
  const visibleNavItems = NAV_ITEMS;

  return (
    <DialogPrimitive.Root onOpenChange={setMobileOpen} open={mobileOpen}>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[1px] focus:border focus:border-foreground focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href="#main-content"
        >
          Skip to main content
        </a>

        <OfflineBanner />

        <header className="sticky top-0 z-30 h-[4.5rem] border-b border-foreground bg-background px-[var(--evimesh-container-px)]">
          <div className="mx-auto flex h-full max-w-[96rem] min-w-0 items-center gap-2">
            <DialogPrimitive.Trigger asChild>
              <button
                aria-label="Open navigation"
                className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-[1px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden', FOCUS_RING)}
                type="button"
              >
                <Menu aria-hidden="true" size={18} />
              </button>
            </DialogPrimitive.Trigger>

          <BrandLink onNavigate={close} />
          <GlobalNav items={visibleNavItems} pathname={pathname} />
          <div className="flex-1" />

          {!isLanding ? (
            <Link
              className={cn('hidden h-9 w-48 items-center gap-2 border-b border-foreground bg-transparent px-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground 2xl:flex', FOCUS_RING)}
              href="/explore"
            >
              <Search aria-hidden="true" size={14} />
              <span className="truncate">Search research</span>
              <kbd className="ml-auto border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">/</kbd>
            </Link>
          ) : null}

          <ThemeToggle />

          {!isLanding ? (
            <>
              {/* No unread badge: an unread API does not exist. */}
              <Link
                aria-label="Notifications"
                className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-[1px] border border-border bg-transparent text-muted-foreground transition-colors hover:border-foreground hover:text-foreground', FOCUS_RING)}
                href="/notifications"
              >
                <Bell aria-hidden="true" size={15} />
              </Link>
              <Link
                className={cn('hidden h-9 items-center gap-2 rounded-[1px] border border-border bg-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground xl:inline-flex', FOCUS_RING)}
                href="/settings"
              >
                <span aria-hidden="true" className="grid size-5 place-items-center border border-border text-[10px] font-semibold">?</span>
                Account
              </Link>
            </>
          ) : null}

          <Link
            className={cn(
              'h-9 items-center gap-2 rounded-[1px] px-3 text-xs font-semibold transition-colors',
              FOCUS_RING,
              isLanding
                ? 'inline-flex border border-foreground bg-transparent hover:bg-foreground hover:text-background'
                : 'hidden bg-primary text-primary-foreground hover:bg-foreground sm:inline-flex',
            )}
            href="/login"
          >
            <LogIn aria-hidden="true" size={14} />
            Sign in
          </Link>
        </div>
      </header>

      <MobileDrawer isLanding={isLanding} items={visibleNavItems} onClose={close} pathname={pathname} />

      <main className="kinetic-page-enter min-w-0 flex-1" id="main-content" key={pathname}>{children}</main>

      <CommandPalette />
      <ShellFooter />
      </div>
    </DialogPrimitive.Root>
  );
}
