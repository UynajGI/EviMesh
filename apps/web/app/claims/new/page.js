'use client';

import Link from 'next/link';
import { useState } from 'react';

const INITIAL = { statement: '', scope: '{\n  "population": ""\n}', assumptions: '[]', falsification: '{\n  "conditions": []\n}' };

export default function NewClaimPage() {
  const [form, setForm] = useState(INITIAL);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  function previewClaim(event) {
    event.preventDefault();
    try {
      setError(null);
      setPreview({ statement: form.statement.trim(), scope: JSON.parse(form.scope), assumptions: JSON.parse(form.assumptions), falsification: JSON.parse(form.falsification) });
    } catch (reason) {
      setError(`JSON field is invalid: ${reason.message}`);
    }
  }
  return <main className="mx-auto max-w-5xl px-6 py-16"><Link className="text-sm text-primary hover:underline" href="/claims">← Back to Claims</Link><p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-primary">Evidence graph</p><h1 className="mt-3 text-4xl font-semibold">Draft a Claim</h1><p className="mt-4 max-w-3xl text-muted-foreground">Prepare a Claim statement and its structured scope, assumptions, and falsification conditions. Submission will be enabled when the Claim command endpoint is exposed.</p><form className="mt-10 grid gap-5 rounded-xl border border-border bg-card p-6" onSubmit={previewClaim}><label className="grid gap-2 text-sm font-medium">Statement<textarea required className="min-h-28 rounded border border-input bg-background p-3 font-normal" value={form.statement} onChange={update('statement')} placeholder="State the claim precisely." /></label><label className="grid gap-2 text-sm font-medium">Scope (JSON)<textarea required className="min-h-36 rounded border border-input bg-background p-3 font-mono text-sm font-normal" value={form.scope} onChange={update('scope')} /></label><label className="grid gap-2 text-sm font-medium">Assumptions (JSON)<textarea required className="min-h-28 rounded border border-input bg-background p-3 font-mono text-sm font-normal" value={form.assumptions} onChange={update('assumptions')} /></label><label className="grid gap-2 text-sm font-medium">Falsification conditions (JSON)<textarea required className="min-h-36 rounded border border-input bg-background p-3 font-mono text-sm font-normal" value={form.falsification} onChange={update('falsification')} /></label><button className="w-fit rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" type="submit">Preview Claim</button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form>{preview && <section aria-label="Claim preview" className="mt-8 rounded-xl border border-border bg-card p-6"><h2 className="text-xl font-semibold">Claim preview</h2><p className="mt-4 text-lg">{preview.statement}</p><pre className="mt-4 overflow-x-auto rounded bg-muted p-4 text-xs">{JSON.stringify({ scope: preview.scope, assumptions: preview.assumptions, falsification: preview.falsification }, null, 2)}</pre></section>}</main>;
}
