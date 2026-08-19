'use client';

import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/*
 * M13.8 stable-id chip: mono value, truncated, one-click copy. Long ids never
 * become bare hash walls; the full value is always copyable.
 */
export function IdChip({ value, label, className }) {
  const [copied, setCopied] = useState(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    setTimeout(() => setCopied(null), 1400);
  }

  const short = value.length > 18 ? `${value.slice(0, 14)}…${value.slice(-6)}` : value;

  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-sm border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground', className)}>
      {label ? <span className="text-foreground/70">{label}</span> : null}
      <span className="truncate tabular-nums" title={value}>{short}</span>
      <button
        aria-label={copied === true ? 'Copied' : `Copy ${label ?? 'stable id'}`}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        onClick={copy}
        type="button"
      >
        {copied === true ? <Check aria-hidden="true" size={12} /> : copied === false ? <X aria-hidden="true" size={12} /> : <Copy aria-hidden="true" size={12} />}
      </button>
    </span>
  );
}
