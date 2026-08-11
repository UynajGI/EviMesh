'use client';

import Link from 'next/link';
import { useState } from 'react';

/*
 * Primary navigation (M13.5-A06/B09): at most six first-level items, one
 * primary action, and a collapsible mobile menu. Secondary and write actions
 * live under the overflow menu so the bar stays calm on every viewport.
 */
const primaryLinks = [
  { href: '/projects', label: 'Projects' },
  { href: '/questions', label: 'Questions' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/claims', label: 'Claims' },
  { href: '/verification', label: 'Verification' },
  { href: '/events', label: 'Events' },
];

const overflowLinks = [
  { href: '/questions/new', label: 'Ask a question' },
  { href: '/claims/new', label: 'Draft a claim' },
  { href: '/artifacts/upload', label: 'Upload evidence' },
  { href: '/runs/new', label: 'Record a run' },
  { href: '/evidence/new', label: 'Create evidence' },
  { href: '/verification/receipt/new', label: 'Submit verification' },
  { href: '/challenges/new', label: 'Challenge a claim' },
  { href: '/contributions', label: 'Contributions' },
  { href: '/settings', label: 'Settings' },
];

function NavList({ className, onNavigate }) {
  return (
    <ul className={className}>
      {primaryLinks.map((link) => (
        <li key={link.href}>
          <Link className="text-sm text-muted-foreground transition-colors hover:text-foreground" href={link.href} onClick={onNavigate}>{link.label}</Link>
        </li>
      ))}
    </ul>
  );
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <nav aria-label="Primary navigation" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-8">
          <Link className="text-base font-semibold tracking-tight text-foreground" href="/" onClick={() => setOpen(false)}>EviMesh</Link>
          <div className="hidden md:block">
            <NavList className="flex items-center gap-6" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a className="hidden rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:inline-flex" href="/questions/new">Ask a question</a>
          <button aria-expanded={open} aria-label="Toggle navigation menu" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground md:hidden" onClick={() => setOpen((value) => !value)} type="button">
            <span aria-hidden="true" className="text-lg leading-none">{open ? '×' : '≡'}</span>
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-border px-6 py-4 md:hidden">
          <NavList className="flex flex-col gap-3" onNavigate={() => setOpen(false)} />
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">More actions</summary>
            <ul className="mt-2 flex flex-col gap-3">
              {overflowLinks.map((link) => (
                <li key={link.href}><Link className="text-sm text-muted-foreground" href={link.href} onClick={() => setOpen(false)}>{link.label}</Link></li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </header>
  );
}
