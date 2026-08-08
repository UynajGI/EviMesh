'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';

const STEP_TITLES = {
  1: 'Frame the question',
  2: 'Define the scope',
  3: 'Describe progress and falsification',
  4: 'Set permissions and risks',
};

const STEP_INTROS = {
  1: 'State what you want to learn and why the answer matters. Later steps will define the scope, progress, and safeguards.',
  2: 'Make the investigation bounded and reproducible by stating what is included and what is explicitly out of scope.',
  3: 'Record what is already known and the evidence that would show the question should be rejected or revised.',
  4: 'Choose the sharing license and identify risks that reviewers should understand before submission.',
};

export default function NewQuestionPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState({ questionId: '', projectId: '', contractId: '', contractRevision: '1', title: '', statement: '', value: '', scope: '', exclusions: '', progress: '', falsification: '', license: '', risks: '' });
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function update(field, value) {
    setSaved(false);
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function advance(event, nextStep) {
    event.preventDefault();
    setSaved(false);
    setStep(nextStep);
  }

  function reviewQuestion(event) {
    event.preventDefault();
    setPreview(true);
    setSaved(false);
  }

  async function submitQuestion() {
    setSubmitError(null);
    try {
      const { createBrowserSupabaseClient } = await import('@/lib/supabase-browser');
      const { data } = await createBrowserSupabaseClient().auth.getSession();
      const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/questions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${data.session?.access_token ?? ''}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ...draft, researchContract: { contractId: draft.contractId, revision: Number(draft.contractRevision) } }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Question submission failed.');
      router.push(`/questions/${body.question.questionId}`);
    } catch (error) { setSubmitError(error.message); }
  }

  const nextAction = step === 1 ? { label: 'Continue to scope', handler: (event) => advance(event, 2) } : step === 2 ? { label: 'Continue to progress', handler: (event) => advance(event, 3) } : step === 3 ? { label: 'Continue to permissions', handler: (event) => advance(event, 4) } : { label: 'Review question', handler: reviewQuestion };

  return <PageContainer><Link className="text-sm font-medium text-primary" href="/projects">← Back to projects</Link><PageHeader eyebrow={`Question submission · Step ${step} of 4`} title={STEP_TITLES[step]} description={STEP_INTROS[step]} />
    <form onSubmit={nextAction.handler} className="mt-10 space-y-6 rounded-lg border border-border bg-card p-6">
      {preview ? <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">Normalized question object</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Review before submission</h2><p className="mt-3 text-sm text-muted-foreground">Check every field before the formal submit action in the next step.</p></div><pre aria-label="Normalized question object" className="max-h-[32rem] overflow-auto rounded-lg bg-muted p-5 text-sm leading-6 text-foreground">{JSON.stringify(draft, null, 2)}</pre><div className="flex gap-3"><Button type="button" variant="outline" onClick={() => setPreview(false)}>Back to edit</Button><Button type="button" onClick={submitQuestion}>Submit question</Button></div>{submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}</div> : <>
      {step === 1 ? <>
        <div className="grid gap-2"><Label htmlFor="question-id">Question ID</Label><Input id="question-id" required aria-label="Question ID" placeholder="A stable question ID" value={draft.questionId} onChange={(event) => update('questionId', event.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="project-id">Project ID</Label><Input id="project-id" required aria-label="Project ID" placeholder="The project that owns this question" value={draft.projectId} onChange={(event) => update('projectId', event.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="question-title">Question title</Label><Input id="question-title" required aria-label="Question title" placeholder="A concise title" value={draft.title} onChange={(event) => update('title', event.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="question-statement">Question</Label><Textarea id="question-statement" required aria-label="Question statement" className="min-h-36" placeholder="What should the network investigate?" value={draft.statement} onChange={(event) => update('statement', event.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="question-value">Why is this valuable?</Label><Textarea id="question-value" required aria-label="Question value" className="min-h-28" placeholder="Describe the expected scientific or practical value." value={draft.value} onChange={(event) => update('value', event.target.value)} /></div>
      </> : step === 2 ? <>
        <div className="grid gap-2"><Label htmlFor="question-scope">Scope</Label><Textarea id="question-scope" required aria-label="Question scope" className="min-h-36" placeholder="What populations, methods, or conditions are included?" value={draft.scope} onChange={(event) => update('scope', event.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="question-exclusions">Exclusions</Label><Textarea id="question-exclusions" required aria-label="Question exclusions" className="min-h-28" placeholder="What is explicitly outside this question?" value={draft.exclusions} onChange={(event) => update('exclusions', event.target.value)} /></div>
      </> : step === 3 ? <>
        <div className="grid gap-2"><Label htmlFor="question-progress">Current progress</Label><Textarea id="question-progress" required aria-label="Question progress" className="min-h-36" placeholder="What evidence or prior work already exists?" value={draft.progress} onChange={(event) => update('progress', event.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="question-falsification">Falsification conditions</Label><Textarea id="question-falsification" required aria-label="Question falsification conditions" className="min-h-28" placeholder="What observation would disprove or materially revise this question?" value={draft.falsification} onChange={(event) => update('falsification', event.target.value)} /></div>
      </> : <>
        <div className="grid gap-2"><Label htmlFor="contract-id">Research contract ID</Label><Input id="contract-id" required aria-label="Research contract ID" placeholder="Immutable contract reference" value={draft.contractId} onChange={(event) => update('contractId', event.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="contract-revision">Contract revision</Label><Input id="contract-revision" required aria-label="Contract revision" min="1" type="number" value={draft.contractRevision} onChange={(event) => update('contractRevision', event.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="question-license">License</Label><Input id="question-license" required aria-label="Question license" placeholder="For example, CC-BY-4.0" value={draft.license} onChange={(event) => update('license', event.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="question-risks">Risks and safeguards</Label><Textarea id="question-risks" required aria-label="Question risks" className="min-h-36" placeholder="Describe foreseeable risks and how contributors should handle them." value={draft.risks} onChange={(event) => update('risks', event.target.value)} /></div>
      </>}
      <div className="flex items-center justify-between gap-4"><Button type="button" variant="outline" onClick={() => { setSaved(false); setStep(Math.max(1, step - 1)); }} disabled={step === 1}>Back</Button><Button type="submit">{nextAction.label}</Button></div>
      {saved && <p role="status" className="text-sm text-primary">Step 4 is complete. The question is ready for review.</p>}
      </>}
    </form>
  </PageContainer>;
}
