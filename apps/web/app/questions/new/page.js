'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NewQuestionPage() {
  const [draft, setDraft] = useState({ title: '', statement: '', value: '' });
  const [saved, setSaved] = useState(false);

  function update(field, value) {
    setSaved(false);
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function continueToScope(event) {
    event.preventDefault();
    setSaved(true);
  }

  return <main className="mx-auto max-w-3xl px-6 py-16">
    <Link className="text-sm font-medium text-primary" href="/projects">← Back to projects</Link>
    <p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-primary">Question submission · Step 1 of 4</p>
    <h1 className="mt-3 text-5xl font-semibold tracking-tight">Frame the question</h1>
    <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">State what you want to learn and why the answer matters. Later steps will define the scope, progress, and safeguards.</p>
    <form onSubmit={continueToScope} className="mt-10 space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
      <label className="block"><span className="text-sm font-semibold">Question title</span><Input required className="mt-2" aria-label="Question title" placeholder="A concise title" value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
      <label className="block"><span className="text-sm font-semibold">Question</span><textarea required aria-label="Question statement" className="mt-2 min-h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="What should the network investigate?" value={draft.statement} onChange={(event) => update('statement', event.target.value)} /></label>
      <label className="block"><span className="text-sm font-semibold">Why is this valuable?</span><textarea required aria-label="Question value" className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="Describe the expected scientific or practical value." value={draft.value} onChange={(event) => update('value', event.target.value)} /></label>
      <div className="flex items-center justify-between gap-4"><span className="text-sm text-muted-foreground">Your draft remains on this step until you continue.</span><Button type="submit">Continue to scope</Button></div>
      {saved && <p role="status" className="text-sm text-primary">Step 1 is complete. Scope fields are ready for the next step.</p>}
    </form>
  </main>;
}
