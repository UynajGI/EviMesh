import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/questions/new', label: 'Ask a question' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/claims', label: 'Claims' },
  { href: '/claims/new', label: 'Draft a claim' },
  { href: '/artifacts/upload', label: 'Upload evidence' },
  { href: '/runs/new', label: 'Record a run' },
  { href: '/evidence/new', label: 'Create evidence' },
  { href: '/verification', label: 'Verification' },
  { href: '/contributions', label: 'Contributions' },
  { href: '/sign-in', label: 'Sign in' },
  { href: '/settings', label: 'Settings' },
  { href: '/settings/keys', label: 'Keys' },
  { href: '/settings/tokens', label: 'Tokens' },
];

export function SiteNav() {
  return (
    <header className="border-b border-border bg-card">
      <nav aria-label="Primary navigation" className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link className="font-semibold tracking-tight text-foreground" href="/">EviMesh</Link>
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm font-medium text-muted-foreground">
          {links.map((link) => <Link className="transition-colors hover:text-foreground" href={link.href} key={link.href}>{link.label}</Link>)}
        </div>
      </nav>
    </header>
  );
}
