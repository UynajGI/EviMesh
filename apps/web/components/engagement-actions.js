'use client';

import { Bookmark, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

/*
 * Private navigation signals (design book 02 color language): a helpful mark
 * and a save are personal notes. They never render counts anywhere and never
 * imply a public verdict on research validity.
 */

const ACTIONS = [
  { kind: 'helpful', label: 'Useful', Icon: Heart, title: 'Mark useful — a private note, never a public count' },
  { kind: 'favorite', label: 'Save', Icon: Bookmark, title: 'Save to your personal list' },
];

export function EngagementActions({ objectType, objectId, has, onToggle, compact = false }) {
  return (
    <div className={cn('flex items-center gap-1', compact ? '' : 'gap-2')} data-engagement={objectType}>
      {ACTIONS.map(({ kind, label, Icon, title }) => {
        const active = Boolean(has(objectType, objectId, kind));
        return (
          <button
            aria-label={`${active ? 'Remove' : 'Add'} ${label.toLowerCase()}${active ? '' : ' — private'}`}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
              active ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
              compact && 'px-1.5',
            )}
            key={kind}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggle(objectType, objectId, kind);
            }}
            title={title}
            type="button"
          >
            <Icon aria-hidden="true" fill={active ? 'currentColor' : 'none'} size={13} />
            {compact ? null : label}
          </button>
        );
      })}
    </div>
  );
}
