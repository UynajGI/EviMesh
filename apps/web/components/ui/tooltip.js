'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/*
 * Simple tooltip (M13.5-B08): hover or keyboard focus reveals the label; the
 * trigger keeps its accessible name and the tooltip is announced via
 * aria-describedby. Positioned with the wrapping group, no portal needed.
 */
export function Tooltip({ label, children, className }) {
  const [id] = useState(() => `tooltip-${Math.random().toString(36).slice(2, 8)}`);
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      <span aria-describedby={id}>{children}</span>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-60 -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground opacity-0 shadow-sm transition-opacity group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
        id={id}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}
