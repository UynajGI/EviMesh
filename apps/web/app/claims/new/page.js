'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { loadDraft, saveDraft } from '@/lib/draft-store';
import { downloadDraftBundle, readDraftBundle } from '@/lib/draft-bundle';

const INITIAL = { statement: '', parentClaimId: '', scope: '{\n  "population": ""\n}', assumptions: '[]', falsification: '{\n  "conditions": []\n}' };
const DRAFT_KEY = 'claim:new';

const STEP_TITLES = {
  1: 'State the claim',
  2: 'Structure the claim',
  3: 'Preview the claim',
};

const STEP_INTROS = {
  1: 'Write the precise statement and, if this claim builds on another, link its parent claim.',
  2: 'Fill the structured scope, assumptions, and falsification conditions as JSON.',
  3: 'Validate the normalized object before export. Submission is enabled once the Claim command endpoint is exposed.',
};

export default function NewClaimPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [draftMessage, setDraftMessage] = useState(null);

  useEffect(() => {
    let active = true;
    loadDraft(DRAFT_KEY, INITIAL).then((draft) => {
      if (!active) return;
      setForm({ ...INITIAL, ...draft });
      setHydrated(true);
      if (JSON.stringify(draft) !== JSON.stringify(INITIAL)) setDraftMessage('Draft restored from this browser.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = window.setTimeout(() => {
      saveDraft(DRAFT_KEY, form).then((saved) => { if (saved) setDraftMessage('Draft saved locally.'); });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form, hydrated]);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  function previewClaim(event) {
    event.preventDefault();
    try {
      setError(null);
      setPreview({ statement: form.statement.trim(), parentClaimId: form.parentClaimId.trim(), scope: JSON.parse(form.scope), assumptions: JSON.parse(form.assumptions), falsification: JSON.parse(form.falsification) });
      setStep(3);
    } catch (reason) {
      setError(`JSON field is invalid: ${reason.message}`);
    }
  }

  async function importDraft(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try { setForm({ ...INITIAL, ...(await readDraftBundle(file)) }); setPreview(null); setError(null); setDraftMessage('Draft imported.'); }
    catch (reason) { setError(reason.message); }
    finally { event.target.value = ''; }
  }

  const nextAction = step === 1 ? { label: 'Structure the claim', handler: (event) => { event.preventDefault(); setStep(2); } } : { label: 'Preview Claim', handler: previewClaim };

  return <PageContainer><Link className="text-sm font-medium text-primary hover:underline" href="/claims">← Back to Claims</Link><PageHeader eyebrow={`Evidence graph · Step ${step} of 3`} title="Draft a Claim" description="Prepare a Claim statement and its structured scope, assumptions, and falsification conditions. Submission will be enabled when the Claim command endpoint is exposed." />
    {draftMessage && <p role="status" className="mt-3 text-sm text-muted-foreground">{draftMessage}</p>}
    <form className="mt-8 grid gap-5 rounded-lg border border-border bg-card p-6" onSubmit={nextAction.handler}>
      {step === 1 ? <>
        <div className="grid gap-2"><Label htmlFor="claim-statement">Statement</Label><Textarea id="claim-statement" required className="min-h-28" value={form.statement} onChange={update('statement')} placeholder="State the claim precisely." /></div>
        <div className="grid gap-2"><Label htmlFor="claim-parent">Parent claim (optional)</Label><Input id="claim-parent" value={form.parentClaimId} onChange={update('parentClaimId')} placeholder="claim-id this claim builds on" /><p className="text-xs text-muted-foreground">Links this claim to the upstream claim it refines or extends.</p></div>
      </> : step === 2 ? <>
        <div className="grid gap-2"><Label htmlFor="claim-scope">Scope (JSON)</Label><Textarea id="claim-scope" required className="min-h-36 font-mono text-sm" value={form.scope} onChange={update('scope')} /></div>
        <div className="grid gap-2"><Label htmlFor="claim-assumptions">Assumptions (JSON)</Label><Textarea id="claim-assumptions" required className="min-h-28 font-mono text-sm" value={form.assumptions} onChange={update('assumptions')} /></div>
        <div className="grid gap-2"><Label htmlFor="claim-falsification">Falsification conditions (JSON)</Label><Textarea id="claim-falsification" required className="min-h-36 font-mono text-sm" value={form.falsification} onChange={update('falsification')} /></div>
      </> : <>
        <p className="text-lg font-semibold">Claim preview</p>
        {preview ? <><p className="text-lg">{preview.statement}</p>{preview.parentClaimId && <p className="mt-2 text-sm text-muted-foreground">Parent claim <span className="tabular-nums">{preview.parentClaimId}</span></p>}<pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">{JSON.stringify({ scope: preview.scope, assumptions: preview.assumptions, falsification: preview.falsification }, null, 2)}</pre></> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
      </>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-3"><Button type="button" variant="outline" onClick={() => { setError(null); setStep(Math.max(1, step - 1)); }} disabled={step === 1}>Back</Button><Button type="submit">{nextAction.label}</Button></div>
        {step === 3 ? <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => downloadDraftBundle(form, 'json')}>Download JSON</Button><Button type="button" variant="outline" onClick={() => downloadDraftBundle(form, 'zip')}>Download ZIP</Button><label className="inline-flex cursor-pointer items-center rounded-md border border-border px-4 py-2 text-sm font-medium">Import Bundle<input className="sr-only" type="file" accept=".json,.zip,application/json,application/zip" onChange={importDraft} /></label></div> : null}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  </PageContainer>;
}
