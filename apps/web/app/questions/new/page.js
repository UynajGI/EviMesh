'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NewQuestionPage() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState({ title: '', statement: '', value: '', scope: '', exclusions: '' });
  const [saved, setSaved] = useState(false);

  function update(field, value) {
    setSaved(false);
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function continueToScope(event) {
    event.preventDefault();
    setSaved(false);
    setStep(2);
  }

  function continueToProgress(event) {
    event.preventDefault();
    setSaved(true);
  }

  return <main className="mx-auto max-w-3xl px-6 py-16">
    <Link className="text-sm font-medium text-primary" href="/projects">← Back to projects</Link>
    <p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-primary">Question submission · {step === 1 ? 'Step 1 of 4' : 'Step 2 of 4'}</p>
    <h1 className="mt-3 text-5xl font-semibold tracking-tight">{step === 1 ? 'Frame the question' : 'Define the scope'}</h1>
    <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">{step === 1 ? 'State what you want to learn and why the answer matters. Later steps will define the scope, progress, and safeguards.' : 'Make the investigation bounded and reproducible by stating what is included and what is explicitly out of scope.'}</p>
    <form onSubmit={step === 1 ? continueToScope : continueToProgress} className="mt-10 space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
      {step === 1 ? <>
        <label className="block"><span className="text-sm font-semibold">Question title</span><Input required className="mt-2" aria-label="Question title" placeholder="A concise title" value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
        <label className="block"><span className="text-sm font-semibold">Question</span><textarea required aria-label="Question statement" className="mt-2 min-h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="What should the network investigate?" value={draft.statement} onChange={(event) => update('statement', event.target.value)} /></label>
        <label className="block"><span className="text-sm font-semibold">Why is this valuable?</span><textarea required aria-label="Question value" className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="Describe the expected scientific or practical value." value={draft.value} onChange={(event) => update('value', event.target.value)} /></label>
      </> : <>
        <label className="block"><span className="text-sm font-semibold">Scope</span><textarea required aria-label="Question scope" className="mt-2 min-h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="What populations, methods, or conditions are included?" value={draft.scope} onChange={(event) => update('scope', event.target.value)} /></label>
        <label className="block"><span className="text-sm font-semibold">Exclusions</span><textarea required aria-label="Question exclusions" className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="What is explicitly outside this question?" value={draft.exclusions} onChange={(event) => update('exclusions', event.target.value)} /></label>
      </>}
      <div className="flex items-center justify-between gap-4"><Button type="button" variant="outline" onClick={() => { setSaved(false); setStep(1); }} disabled={step === 1}>Back</Button><Button type="submit">{step === 1 ? 'Continue to scope' : 'Continue to progress'}</Button></div>
      {saved && <p role="status" className="text-sm text-primary">Step 2 is complete. Progress fields are ready for the next step.</p>}
    </form>
  </main>;
}
