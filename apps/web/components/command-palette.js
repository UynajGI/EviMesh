'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const COMMANDS = [
  { group: 'Go to', label: 'Home', hint: 'G H', href: '/home' },
  { group: 'Go to', label: 'Explore research', hint: 'G E', href: '/explore' },
  { group: 'Go to', label: 'Work queue', hint: 'G W', href: '/work' },
  { group: 'Go to', label: 'Agent connection center', href: '/agent' },
  { group: 'Go to', label: 'Agent manual (Markdown)', href: '/agent/manual' },
  { group: 'Go to', label: 'Event audit', href: '/events' },
  { group: 'Go to', label: 'Contributions', href: '/contributions' },
  { group: 'Go to', label: 'Settings', href: '/settings' },
  { group: 'Go to', label: 'API tokens', href: '/settings/tokens' },
  { group: 'Go to', label: 'Signing keys', href: '/settings/keys' },
];

/*
 * Command palette (M13.8 07-emerging-ui-spec.md §4): the keyboard entry for
 * navigation and search. Object search itself delegates to /explore; this
 * overlay never fabricates results.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
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

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const needle = query.trim().toLowerCase();
  const results = needle
    ? COMMANDS.filter((command) => command.label.toLowerCase().includes(needle))
    : COMMANDS;

  function go(href) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (needle) {
        setOpen(false);
        router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
      } else if (results[active]) {
        go(results[active].href);
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
          placeholder="Type a command, or search objects…"
          ref={inputRef}
          type="text"
          value={query}
        />
        <ul aria-label="Results" className="max-h-80 overflow-y-auto p-2" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matching command. Press Enter to search objects on Explore.
            </li>
          ) : results.map((command, index) => {
            const header = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <li key={command.href + command.label}>
                {header ? <p aria-hidden="true" className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{header}</p> : null}
                <button
                  aria-selected={index === active}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                    index === active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted',
                  )}
                  onClick={() => go(command.href)}
                  onMouseEnter={() => setActive(index)}
                  role="option"
                  type="button"
                >
                  {command.label}
                  {command.hint ? <span className="ml-auto font-mono text-[11px] text-muted-foreground">{command.hint}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="flex gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <span><kbd className="rounded border border-border bg-muted px-1 font-mono">↑</kbd> <kbd className="rounded border border-border bg-muted px-1 font-mono">↓</kbd> select</span>
          <span><kbd className="rounded border border-border bg-muted px-1 font-mono">↵</kbd> {needle ? 'search objects' : 'open'}</span>
          <span><kbd className="rounded border border-border bg-muted px-1 font-mono">Esc</kbd> close</span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
