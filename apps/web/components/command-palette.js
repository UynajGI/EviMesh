'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const THEME_STORAGE_KEY = 'evimesh-theme';

const COMMANDS = [
  { group: 'Go to', label: 'Home', hint: 'G H', href: '/home' },
  { group: 'Go to', label: 'Explore research', hint: 'G E', href: '/explore' },
  { group: 'Go to', label: 'Work queue', hint: 'G W', href: '/work' },
  { group: 'Go to', label: 'Agent connection center', hint: 'G A', href: '/agent' },
  { group: 'Go to', label: 'Agent manual (Markdown)', href: '/agent.md' },
  { group: 'Go to', label: 'Event audit', href: '/events' },
  { group: 'Go to', label: 'Contributions', href: '/contributions' },
  { group: 'Go to', label: 'Settings', href: '/settings' },
  { group: 'Go to', label: 'API tokens', href: '/settings/tokens' },
  { group: 'Go to', label: 'Signing keys', href: '/settings/keys' },
  { group: 'Actions', label: 'Copy this page permalink', hint: 'Y', action: 'copy-permalink' },
  { group: 'Actions', label: 'Hand new work to your agent', href: '/work' },
  { group: 'Theme', label: 'Switch to light theme', action: 'theme-light' },
  { group: 'Theme', label: 'Switch to dark theme', action: 'theme-dark' },
  { group: 'Theme', label: 'Follow system theme', action: 'theme-system' },
];

/* Bounded object index for the palette's object group (mockup 对象组): one
 * page per object type, fetched once per palette session and filtered
 * client-side by stable id. Real ids only; nothing is fabricated. */
const OBJECT_SOURCES = [
  { kind: 'question', listPath: '/questions?limit=20', idKey: 'questionId', hrefFor: (id) => `/questions/${id}` },
  { kind: 'project', listPath: '/projects?limit=20', idKey: 'projectId', hrefFor: (id) => `/projects/${id}` },
  { kind: 'claim', listPath: '/claims?limit=20', idKey: 'claimId', hrefFor: (id) => `/claims/${id}` },
];

/*
 * Command palette (M13.8 07-emerging-ui-spec.md §4): the keyboard entry for
 * navigation, actions, theme, and object search. Object rows come from a
 * bounded live read; Enter prefers the highlighted row and falls back to a
 * full search on Explore.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [objects, setObjects] = useState([]);
  const [notice, setNotice] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function onKeyDown(event) {
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '') || event.target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === '/' && !inField) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /* One bounded load per open: the 20 newest objects per type, real ids only. */
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    setNotice(null);
    setTimeout(() => inputRef.current?.focus(), 0);
    let cancelled = false;
    Promise.all(OBJECT_SOURCES.map(async ({ kind, listPath, idKey, hrefFor }) => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${listPath}`);
        const payload = await response.json();
        if (!response.ok) return [];
        return (payload.items ?? []).map((item) => ({ group: 'Objects', label: item[idKey], sub: kind, href: hrefFor(item[idKey]) }));
      } catch {
        return [];
      }
    })).then((groups) => { if (!cancelled) setObjects(groups.flat()); });
    return () => { cancelled = true; };
  }, [open]);

  function applyTheme(value) {
    if (value === 'system') {
      // The stylesheet has a single [data-theme="dark"] block and no media
      // fallback, so "system" resolves to a concrete value here; storage is
      // cleared so the layout bootstrap keeps following OS changes.
      const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      try { localStorage.removeItem(THEME_STORAGE_KEY); } catch { /* unavailable */ }
    } else {
      document.documentElement.setAttribute('data-theme', value);
      try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* unavailable */ }
    }
  }

  async function run(command) {
    setOpen(false);
    if (command.href) {
      router.push(command.href);
      return;
    }
    if (command.action === 'copy-permalink') {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setNotice('Permalink copied to the clipboard.');
      } catch {
        setNotice('Copying was blocked by the browser.');
      }
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    if (command.action === 'theme-light') applyTheme('light');
    if (command.action === 'theme-dark') applyTheme('dark');
    if (command.action === 'theme-system') applyTheme('system');
  }

  const needle = query.trim().toLowerCase();
  const matchedCommands = needle
    ? COMMANDS.filter((command) => command.label.toLowerCase().includes(needle))
    : COMMANDS;
  const matchedObjects = needle
    ? objects.filter((object) => object.label.toLowerCase().includes(needle)).slice(0, 8)
    : [];
  const results = [...matchedCommands, ...matchedObjects];

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // Execute the highlighted row when one matches; fall back to object
      // search on Explore only when no row matches the query.
      if (results[active]) {
        run(results[active]);
      } else if (needle) {
        setOpen(false);
        router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  let lastGroup = null;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent aria-label="Command palette" className="top-24 max-w-lg translate-y-0 p-0">
        <input
          aria-label="Search commands or research"
          className="w-full border-b border-border bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-muted-foreground"
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          placeholder="Type a command, or search objects by stable id…"
          ref={inputRef}
          type="text"
          value={query}
        />
        {notice ? <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground" role="status">{notice}</p> : null}
        <ul aria-label="Results" className="max-h-80 overflow-y-auto p-2" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matching row. Press Enter to search objects on Explore.
            </li>
          ) : results.map((command, index) => {
            const header = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <li key={(command.href ?? command.action ?? '') + command.label}>
                {header ? <p aria-hidden="true" className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{header}</p> : null}
                <button
                  aria-selected={index === active}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                    index === active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted',
                  )}
                  onClick={() => run(command)}
                  onMouseEnter={() => setActive(index)}
                  role="option"
                  type="button"
                >
                  {command.sub ? (
                    <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{command.sub}</span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{command.label}</span>
                  {command.hint ? (
                    <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{command.hint}</kbd>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="rounded border border-border bg-background px-1 font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="rounded border border-border bg-background px-1 font-mono">↵</kbd> run</span>
          <span><kbd className="rounded border border-border bg-background px-1 font-mono">Esc</kbd> close</span>
          <span className="ml-auto">Object search also runs on Explore.</span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
