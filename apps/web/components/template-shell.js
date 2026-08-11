'use client';

// Application shell adapted from TailAdmin's MIT-licensed Next.js template.
// See THIRD_PARTY_NOTICES.md.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, Bot, ChevronLeft, ChevronRight, CircleHelp, FileCheck2,
  FolderKanban, GitPullRequestArrow, KeyRound, LayoutDashboard, LogIn,
  Menu, Network, Search, ShieldCheck, X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const groups = [
  {
    label: 'Workspace',
    links: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/projects', label: 'Projects', icon: FolderKanban },
      { href: '/questions', label: 'Questions', icon: CircleHelp },
      { href: '/claims', label: 'Claims', icon: GitPullRequestArrow },
      { href: '/tasks', label: 'Tasks', icon: FileCheck2 },
      { href: '/verification', label: 'Verification', icon: ShieldCheck },
    ],
  },
  {
    label: 'Connect',
    links: [
      { href: '/agent', label: 'Agent manual', icon: Bot },
      { href: '/settings/tokens', label: 'API tokens', icon: KeyRound },
      { href: '/events', label: 'Activity', icon: Activity },
    ],
  },
];

function isActive(pathname, href) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function Sidebar({ compact, mobileOpen, pathname, onClose, onCompact }) {
  return (
    <>
      {mobileOpen ? <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden" onClick={onClose} type="button" /> : null}
      <aside className={cn(
        'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-300 dark:border-slate-800 dark:bg-slate-950',
        compact ? 'w-[88px]' : 'w-[290px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        <div className={cn('flex h-[76px] items-center border-b border-slate-100 px-5 dark:border-slate-800', compact ? 'justify-center' : 'justify-between')}>
          <Link className="flex items-center gap-3" href="/" onClick={onClose}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20"><Network aria-hidden="true" size={21} /></span>
            {!compact ? <span><span className="block text-lg font-bold tracking-[-0.03em] text-slate-900 dark:text-white">EviMesh</span><span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Research network</span></span> : null}
          </Link>
          {!compact ? <button aria-label="Close navigation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={onClose} type="button"><X size={18} /></button> : null}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-6">
          {groups.map((group) => (
            <section className="mb-7" key={group.label}>
              <p className={cn('mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400', compact && 'text-center text-[9px]')}>{compact ? '•••' : group.label}</p>
              <nav className="space-y-1" aria-label={group.label}>
                {group.links.map(({ href, label, icon: Icon }) => (
                  <Link className={cn(
                    'group flex h-11 items-center rounded-lg text-sm font-medium transition-colors',
                    compact ? 'justify-center px-2' : 'gap-3 px-3',
                    isActive(pathname, href) ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white',
                  )} href={href} key={href} onClick={onClose} title={compact ? label : undefined}>
                    <Icon aria-hidden="true" className="shrink-0" size={19} strokeWidth={1.9} />
                    {!compact ? <span>{label}</span> : null}
                  </Link>
                ))}
              </nav>
            </section>
          ))}
        </div>

        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          {!compact ? <div className="mb-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-900"><p className="text-sm font-semibold text-slate-900 dark:text-white">Work with an Agent</p><p className="mt-1 text-xs leading-5 text-slate-500">Connect CLI or MCP to research with structured context.</p><Link className="mt-3 inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700" href="/agent">Open setup guide →</Link></div> : null}
          <button aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden h-10 w-full items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 lg:flex dark:border-slate-800 dark:hover:bg-slate-900" onClick={onCompact} type="button">
            {compact ? <ChevronRight size={17} /> : <><ChevronLeft size={17} /><span className="ml-2 text-xs font-medium">Collapse</span></>}
          </button>
        </div>
      </aside>
    </>
  );
}

function Header({ compact, onMenu }) {
  return (
    <header className={cn('fixed right-0 top-0 z-30 h-[76px] border-b border-slate-200 bg-white/95 backdrop-blur transition-[left] duration-300 dark:border-slate-800 dark:bg-slate-950/95', compact ? 'lg:left-[88px]' : 'lg:left-[290px]', 'left-0')}>
      <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button aria-label="Open navigation" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 lg:hidden dark:border-slate-800" onClick={onMenu} type="button"><Menu size={19} /></button>
          <Link className="hidden h-10 min-w-[260px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 md:flex dark:border-slate-800 dark:bg-slate-900" href="/questions"><Search aria-hidden="true" size={17} /><span>Search research questions…</span><kbd className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-950">⌘ K</kbd></Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:inline-flex dark:text-slate-300 dark:hover:bg-slate-900" href="/agent"><Bot aria-hidden="true" className="mr-2" size={16} />Agent manual</Link>
          <Link className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700" href="/login"><LogIn aria-hidden="true" size={16} />Login</Link>
        </div>
      </div>
    </header>
  );
}

export function TemplateShell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  if (pathname === '/login' || pathname === '/sign-in') return children;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar compact={compact} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onCompact={() => setCompact((value) => !value)} pathname={pathname} />
      <Header compact={compact} onMenu={() => setMobileOpen(true)} />
      <div className={cn('min-h-screen pt-[76px] transition-[margin] duration-300', compact ? 'lg:ml-[88px]' : 'lg:ml-[290px]')}>
        {children}
      </div>
    </div>
  );
}
