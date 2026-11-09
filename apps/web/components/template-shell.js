'use client';

/*
 * Product shell in the controlled-document grammar (apps/web/PRODUCT.md,
 * .impeccable surface brief): one quiet ruled header row with the seven
 * publication destinations (Home / Explore / Work / Tools / Contributions /
 * Agent / Docs), global search, notifications, theme toggle, and an account
 * menu that carries the personal governance surfaces (My Agents, My
 * projects, Steward review). G-key chords and a Radix mobile drawer keep the
 * same inventory reachable on every viewport.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Bell, BookOpen, Bot, Briefcase, ChevronDown, Compass, FolderGit2, House, LogIn, LogOut, Menu, Network, Search,
  ShieldCheck, UserRound, Wrench, X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { CommandPalette } from '@/components/command-palette';
import { OfflineBanner } from '@/components/offline-banner';
import { EviMeshMark } from '@/components/brand-marks';
import { useBrowserSession } from '@/components/session-shell-control';
import { createAdmissionClient } from '@/lib/admission-client.mjs';
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

/* Personal surfaces live behind the account, never in the publication nav. */
const ACCOUNT_ITEMS = [
  { href: '/agents', label: 'My Agents', icon: Bot },
  { href: '/projects/mine', label: 'My projects', icon: FolderGit2 },
  { href: '/settings', label: 'Account settings', icon: UserRound },
];
const STEWARD_ITEM = { href: '/steward', label: 'Steward review', icon: ShieldCheck };

function accountItems(steward) {
  return steward ? [...ACCOUNT_ITEMS.slice(0, 2), STEWARD_ITEM, ACCOUNT_ITEMS[2]] : ACCOUNT_ITEMS;
}

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

/* Steward status is an API fact (/auth/me actorType), not a client guess. The
 * shell only uses it to show the review entry; the API still authorizes. */
function useActorType(auth) {
  const [actorType, setActorType] = useState(null);
  const token = auth.session?.access_token ?? null;
  useEffect(() => {
    if (auth.status !== 'authenticated' || !token) { setActorType(null); return undefined; }
    let cancelled = false;
    createAdmissionClient({ access_token: token }).me()
      .then((me) => { if (!cancelled) setActorType(me?.actorType ?? null); })
      .catch(() => { if (!cancelled) setActorType(null); });
    return () => { cancelled = true; };
  }, [auth.status, token]);
  return actorType;
}

function isActive(pathname, href) {
  if (href === '/home') return pathname === '/home' || pathname === '/';
  if (href === '/agent' && pathname === '/device') return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function GlobalNav({ items, pathname, onNavigate }) {
  return (
    <nav aria-label="Primary" className="hidden h-full min-w-0 items-stretch md:flex">
      {items.map(({ href, label }) => (
        <Link
          aria-current={isActive(pathname, href) ? 'page' : undefined}
          className={cn(
            'kinetic-nav-link relative inline-flex h-full min-w-0 items-center px-2 text-[13px] lg:px-2.5',
            FOCUS_RING,
            isActive(pathname, href)
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          href={href}
          key={href}
          onClick={onNavigate}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function BrandLink({ onNavigate }) {
  return (
    <Link
      className={cn('inline-flex h-full shrink-0 items-center gap-2 pr-3 text-[15px] font-semibold tracking-[-0.01em] lg:pr-5', FOCUS_RING)}
      href="/"
      onClick={onNavigate}
    >
      <EviMeshMark className="size-7 shrink-0" />
      <span className="whitespace-nowrap">
        <span className="text-foreground">Evi</span><span className="text-primary">Mesh</span>
      </span>
    </Link>
  );
}

/* Desktop account menu: a native disclosure so it works before hydration.
 * Outside pointer and Escape close it; items close it on navigation. */
function AccountMenu({ auth, steward }) {
  const ref = useRef(null);
  const email = auth.session?.user?.email;
  useEffect(() => {
    function onPointer(event) {
      if (ref.current?.open && !ref.current.contains(event.target)) ref.current.open = false;
    }
    function onKey(event) {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  const close = () => { if (ref.current) ref.current.open = false; };

  return (
    <details className="group relative" ref={ref}>
      <summary
        aria-label={email ? `Signed in as ${email}. Open account menu` : 'Signed in. Open account menu'}
        className={cn('inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-[2px] px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden', FOCUS_RING)}
      >
        <UserRound aria-hidden="true" size={15} />
        <ChevronDown aria-hidden="true" className="group-open:rotate-180" size={13} />
      </summary>
      <div className="absolute right-0 top-[calc(100%+0.4rem)] z-40 w-60 border border-border bg-background shadow-[0_8px_24px_-12px_color-mix(in_oklch,var(--evimesh-foreground)_25%,transparent)]">
        {email ? <p className="truncate border-b border-border px-3 py-2 text-xs text-muted-foreground" title={email}>{email}</p> : null}
        <ul className="py-1">
          {accountItems(steward).map(({ href, label }) => (
            <li key={href}>
              <Link className={cn('flex h-8 items-center px-3 text-sm text-foreground transition-colors hover:bg-muted', FOCUS_RING)} href={href} onClick={close}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t border-border p-1">
          <button
            className={cn('flex h-8 w-full items-center px-2 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60', FOCUS_RING)}
            disabled={auth.signingOut}
            onClick={async () => { if (await auth.signOut()) close(); }}
            title={auth.error ?? undefined}
            type="button"
          >
            {auth.signingOut ? 'Signing out…' : auth.error ? 'Retry sign out' : 'Sign out'}
          </button>
          {auth.error ? <span className="sr-only" role="alert">{auth.error}</span> : null}
        </div>
      </div>
    </details>
  );
}

function SessionActions({ auth, mobile = false, onNavigate, steward = false }) {
  const actionClass = cn(
    'items-center gap-2 rounded-[2px] text-sm font-medium transition-colors',
    FOCUS_RING,
    mobile ? 'flex h-11 w-full px-3' : 'inline-flex h-9 px-3 text-[13px]',
  );

  if (auth.status === 'loading') {
    return <span aria-live="polite" className={cn('text-muted-foreground', mobile ? 'px-3 py-2 text-sm' : 'hidden text-xs sm:inline')}>Checking session…</span>;
  }

  if (auth.status === 'authenticated') {
    if (!mobile) return <AccountMenu auth={auth} steward={steward} />;
    const email = auth.session?.user?.email;
    return (
      <div className="mt-auto grid gap-1 border-t border-border pt-4">
        <p className="min-w-0 px-3 pb-2 text-xs text-muted-foreground">Signed in{email ? <> as <span className="break-all font-mono text-foreground">{email}</span></> : null}</p>
        {accountItems(steward).map(({ href, label }) => (
          <Link className={cn(actionClass, 'text-muted-foreground hover:bg-muted hover:text-foreground')} href={href} key={href} onClick={onNavigate}>
            {label}
          </Link>
        ))}
        <button
          className={cn(actionClass, 'mt-2 border border-foreground text-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-60')}
          disabled={auth.signingOut}
          onClick={async () => { if (await auth.signOut()) onNavigate?.(); }}
          title={auth.error ?? undefined}
          type="button"
        >
          {auth.signingOut ? 'Signing out…' : auth.error ? 'Retry sign out' : 'Sign out'}
        </button>
        {auth.error ? <span className="sr-only" role="alert">{auth.error}</span> : null}
      </div>
    );
  }

  const expired = auth.status === 'expired';
  const unavailable = auth.status === 'error';
  const href = expired ? '/login?reason=expired' : unavailable ? '/login?reason=session' : '/login';
  const label = expired ? 'Session expired · Sign in again' : unavailable ? 'Session unavailable · Sign in' : 'Sign in';
  return (
    <Link
      className={cn(actionClass, 'border border-foreground/25 text-foreground hover:border-foreground', mobile && 'mt-auto')}
      href={href}
      onClick={onNavigate}
      title={auth.error ?? undefined}
    >
      {label}
    </Link>
  );
}

const FOOTER_LINKS = [
  { href: '/events', label: 'Event audit' },
  { href: '/docs', label: 'Protocol docs' },
  { href: '/governance', label: 'Governance' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

function ShellFooter() {
  return (
    <footer className="border-t border-border py-5 text-[13px] text-muted-foreground">
      <div className="doc-page flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p><span className="font-medium text-foreground">Evi</span><span className="font-medium text-primary">Mesh</span></p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {FOOTER_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link className={cn('underline-offset-4 transition-colors hover:text-foreground hover:underline', FOCUS_RING)} href={href}>{label}</Link>
              </li>
            ))}
            <li>
              <Link className={cn('underline-offset-4 transition-colors hover:text-foreground hover:underline', FOCUS_RING)} href="/settings">Settings</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}

/* Mobile navigation sheet (M13.8 B08): Radix Dialog owns the focus trap,
 * Escape dismissal, aria wiring, and background scroll lock; the hand-built
 * variant only supplies the left-drawer surface. `md:hidden` keeps it a
 * mobile-only surface even while the dialog is open. */
function MobileDrawer({ auth, isLanding, items, onClose, pathname, steward }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/40 md:hidden" />
      <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-40 flex w-[min(22rem,88vw)] flex-col overflow-y-auto border-r border-foreground bg-background p-4 focus:outline-none md:hidden">
        <div className="mb-4 flex items-center justify-between border-b border-foreground pb-3">
          <DialogPrimitive.Title className="text-sm font-semibold">Navigation</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close navigation"
            className={cn('inline-flex size-11 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
          >
            <X aria-hidden="true" size={18} />
          </DialogPrimitive.Close>
        </div>

        <nav aria-label="Primary mobile" className="flex flex-col">
          {items.map(({ href, label }) => (
            <Link
              aria-current={isActive(pathname, href) ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center border-b border-border px-3 text-sm font-medium transition-colors',
                FOCUS_RING,
                isActive(pathname, href) ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              href={href}
              key={href}
              onClick={onClose}
            >
              {label}
            </Link>
          ))}
        </nav>

        {!isLanding ? (
          <div className="mt-4 grid gap-1">
            <Link className={cn('flex h-11 items-center gap-3 rounded-[2px] px-3 text-sm text-muted-foreground transition-colors hover:text-foreground', FOCUS_RING)} href="/explore" onClick={onClose}>
              <Search aria-hidden="true" size={16} /> Search research
            </Link>
            <Link className={cn('flex h-11 items-center gap-3 rounded-[2px] px-3 text-sm text-muted-foreground transition-colors hover:text-foreground', FOCUS_RING)} href="/notifications" onClick={onClose}>
              <Bell aria-hidden="true" size={16} /> Notifications
            </Link>
          </div>
        ) : null}

        <SessionActions auth={auth} mobile onNavigate={onClose} steward={steward} />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function TemplateShell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const auth = useBrowserSession();
  const steward = useActorType(auth) === 'maintainer';
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

  if (pathname === '/login' || pathname === '/sign-in' || pathname === '/auth/callback') return children;

  const close = () => setMobileOpen(false);
  const isLanding = pathname === '/';
  const visibleNavItems = NAV_ITEMS;

  return (
    <DialogPrimitive.Root onOpenChange={setMobileOpen} open={mobileOpen}>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[2px] focus:border focus:border-foreground focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href="#main-content"
        >
          Skip to main content
        </a>

        <OfflineBanner />

        <header className="sticky top-0 z-30 h-12 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="doc-page flex h-full min-w-0 items-center gap-1.5">
            <DialogPrimitive.Trigger asChild>
              <button
                aria-label="Open navigation"
                className={cn('-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden', FOCUS_RING)}
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
                className={cn('hidden h-8 w-56 items-center gap-2 rounded-[2px] border border-border bg-card px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground lg:flex', FOCUS_RING)}
                href="/explore"
              >
                <Search aria-hidden="true" size={14} />
                <span className="truncate">Search research</span>
                <kbd className="ml-auto rounded-[2px] border border-border px-1.5 font-mono text-[11px] text-muted-foreground">/</kbd>
              </Link>
            ) : null}

            <ThemeToggle />

            {!isLanding ? (
              /* No unread badge: an unread API does not exist. */
              <Link
                aria-label="Notifications"
                className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
                href="/notifications"
              >
                <Bell aria-hidden="true" size={16} />
              </Link>
            ) : null}

            <div className="hidden md:block">
              <SessionActions auth={auth} steward={steward} />
            </div>
          </div>
        </header>

        <MobileDrawer isLanding={isLanding} items={visibleNavItems} auth={auth} onClose={close} pathname={pathname} steward={steward} />

        <main className="kinetic-page-enter min-w-0 flex-1" id="main-content" key={pathname}>{children}</main>

        <CommandPalette />
        <ShellFooter />
      </div>
    </DialogPrimitive.Root>
  );
}
