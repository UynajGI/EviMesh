'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NewQuestionPage() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState({ title: '', statement: '', value: '', scope: '', exclusions: '', progress: '', falsification: '', license: '', risks: '' });
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
    setSaved(false);
    setStep(3);
  }

  function continueToPermissions(event) {
    event.preventDefault();
    setSaved(false);
    setStep(4);
  }

  return <main className="mx-auto max-w-3xl px-6 py-16">
    <Link className="text-sm font-medium text-primary" href="/projects">← Back to projects</Link>
    <p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-primary">Question submission · {step === 1 ? 'Step 1 of 4' : step === 2 ? 'Step 2 of 4' : step === 3 ? 'Step 3 of 4' : 'Step 4 of 4'}</p>
    <h1 className="mt-3 text-5xl font-semibold tracking-tight">{step === 1 ? 'Frame the question' : step === 2 ? 'Define the scope' : step === 3 ? 'Describe progress and falsification' : 'Set permissions and risks'}</h1>
    <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">{step === 1 ? 'State what you want to learn and why the answer matters. Later steps will define the scope, progress, and safeguards.' : step === 2 ? 'Make the investigation bounded and reproducible by stating what is included and what is explicitly out of scope.' : step === 3 ? 'Record what is already known and the evidence that would show the question should be rejected or revised.' : 'Choose the sharing license and identify risks that reviewers should understand before submission.'}</p>
    <form onSubmit={step === 1 ? continueToScope : step === 2 ? continueToProgress : step === 3 ? continueToPermissions : (event) => { event.preventDefault(); setSaved(true); }} className="mt-10 space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
      {step === 1 ? <>
        <label className="block"><span className="text-sm font-semibold">Question title</span><Input required className="mt-2" aria-label="Question title" placeholder="A concise title" value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
        <label className="block"><span className="text-sm font-semibold">Question</span><textarea required aria-label="Question statement" className="mt-2 min-h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="What should the network investigate?" value={draft.statement} onChange={(event) => update('statement', event.target.value)} /></label>
        <label className="block"><span className="text-sm font-semibold">Why is this valuable?</span><textarea required aria-label="Question value" className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="Describe the expected scientific or practical value." value={draft.value} onChange={(event) => update('value', event.target.value)} /></label>
      </> : step === 2 ? <>
        <label className="block"><span className="text-sm font-semibold">Scope</span><textarea required aria-label="Question scope" className="mt-2 min-h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="What populations, methods, or conditions are included?" value={draft.scope} onChange={(event) => update('scope', event.target.value)} /></label>
        <label className="block"><span className="text-sm font-semibold">Exclusions</span><textarea required aria-label="Question exclusions" className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="What is explicitly outside this question?" value={draft.exclusions} onChange={(event) => update('exclusions', event.target.value)} /></label>
      </> : step === 3 ? <>
        <label className="block"><span className="text-sm font-semibold">Current progress</span><textarea required aria-label="Question progress" className="mt-2 min-h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="What evidence or prior work already exists?" value={draft.progress} onChange={(event) => update('progress', event.target.value)} /></label>
        <label className="block"><span className="text-sm font-semibold">Falsification conditions</span><textarea required aria-label="Question falsification conditions" className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="What observation would disprove or materially revise this question?" value={draft.falsification} onChange={(event) => update('falsification', event.target.value)} /></label>
      </> : <>
        <label className="block"><span className="text-sm font-semibold">License</span><Input required aria-label="Question license" className="mt-2" placeholder="For example, CC-BY-4.0" value={draft.license} onChange={(event) => update('license', event.target.value)} /></label>
        <label className="block"><span className="text-sm font-semibold">Risks and safeguards</span><textarea required aria-label="Question risks" className="mt-2 min-h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-600" placeholder="Describe foreseeable risks and how contributors should handle them." value={draft.risks} onChange={(event) => update('risks', event.target.value)} /></label>
      </>}
      <div className="flex items-center justify-between gap-4"><Button type="button" variant="outline" onClick={() => { setSaved(false); setStep(Math.max(1, step - 1)); }} disabled={step === 1}>Back</Button><Button type="submit">{step === 1 ? 'Continue to scope' : step === 2 ? 'Continue to progress' : step === 3 ? 'Continue to permissions' : 'Review question'}</Button></div>
      {saved && <p role="status" className="text-sm text-primary">Step 4 is complete. The question is ready for review.</p>}
    </form>
  </main>;
}
