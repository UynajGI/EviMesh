'use client';

/*
 * M13.8 product shell (docs/design/05-core-ui-spec.md): a quiet top header with
 * task-based primary navigation (Home / Explore / Work / Agent / Docs), global
 * search entry, manual theme toggle, and a mobile drawer. Object routes stay
 * reachable as Explore/Work destinations, never as top-level navigation.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BookOpen, Bot, Briefcase, Compass, House, LogIn, Menu, Search, X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { CommandPalette } from '@/components/command-palette';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/home', label: 'Home', icon: House },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/work', label: 'Work', icon: Briefcase },
  { href: '/agent', label: 'Agent', icon: Bot },
  { href: '/docs', label: 'Docs', icon: BookOpen },
];

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

  if (pathname === '/login' || pathname === '/sign-in') return children;

  const close = () => setMobileOpen(false);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-card focus:px-4 focus:py-2 focus:text-sm"
        href="#main-content"
      >
        Skip to main content
      </a>

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

        <Link
          className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent-foreground/90"
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
