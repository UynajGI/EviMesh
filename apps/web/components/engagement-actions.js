'use client';

import { Bookmark, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

/*
 * Private navigation signals (design book 02 color language): a helpful mark
 * and a save are personal notes. They never render counts anywhere and never
 * imply a public verdict on research validity.
 */

const ACTIONS = [
  { kind: 'helpful', label: 'Useful', activeLabel: 'Marked useful', Icon: Heart, title: 'Mark useful. A private note, never a public count' },
  { kind: 'favorite', label: 'Save', activeLabel: 'Saved', Icon: Bookmark, title: 'Save to your personal list' },
];

export function EngagementActions({ objectType, objectId, has, onToggle, compact = false }) {
  return (
    <div className={cn('flex items-center', compact ? 'gap-1' : 'gap-3')} data-engagement={objectType}>
      {ACTIONS.map(({ kind, label, activeLabel, Icon, title }) => {
        const active = Boolean(has(objectType, objectId, kind));
        return (
          <button
            aria-label={`${active ? 'Remove' : 'Add'} ${label.toLowerCase()}${active ? '' : ', private'}`}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center text-xs transition-colors hover:underline',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              compact && 'size-6 justify-center rounded-[2px] hover:bg-muted hover:no-underline',
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
            {compact ? <Icon aria-hidden="true" fill={active ? 'currentColor' : 'none'} size={13} /> : (active ? activeLabel : label)}
          </button>
        );
      })}
    </div>
  );
}
