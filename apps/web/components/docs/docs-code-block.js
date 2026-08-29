'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

/** Copy control for docs code blocks: icon swap with a 2s confirmation. */
export function DocsCopyButton({ code }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      aria-label={copied ? 'Copied' : 'Copy code'}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard unavailable */ }
      }}
      type="button"
    >
      {copied ? <Check aria-hidden="true" size={12} /> : <Copy aria-hidden="true" size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
