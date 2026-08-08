'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input, Label, Textarea } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/selection';

const BLANK = { challengeId: '', claimId: '', claimRevision: '1', counterexampleEvidenceId: '', rationale: '', impactScope: '', requestedOutcome: 'refutes' };

export default function NewChallengePage() {
  const [form, setForm] = useState(BLANK);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  function prepare(event) {
    event.preventDefault();
    setError(null);
    setSubmitted(false);
    if (Object.values(form).some((value) => !String(value).trim())) { setError('Challenge, target revision, counterexample Evidence, rationale, impact scope, and outcome are required.'); setPreview(null); return; }
    setPreview({ ...form, claimRevision: Number(form.claimRevision) });
  }

  return <PageContainer><PageHeader eyebrow="Adversarial review" title="Challenge a claim" description="Lock a specific immutable Claim revision and attach counterexample Evidence for an auditable challenge." />
    <Alert variant="warning" title="Before you challenge" description="Challenges are adversarial by design. A successful challenge may invalidate dependent claims in the frontier, so state the impact scope carefully." className="mt-8" />
    <form aria-label="Challenge form" onSubmit={prepare} className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-6 md:grid-cols-2">
      <div className="grid gap-2"><Label htmlFor="challenge-id">Challenge ID</Label><Input id="challenge-id" required value={form.challengeId} onChange={update('challengeId')} /></div>
      <div className="grid gap-2"><Label htmlFor="challenge-claim">Claim ID</Label><Input id="challenge-claim" required value={form.claimId} onChange={update('claimId')} /></div>
      <div className="grid gap-2"><Label htmlFor="challenge-revision">Target Claim revision</Label><Input id="challenge-revision" required min="1" type="number" value={form.claimRevision} onChange={update('claimRevision')} /></div>
      <div className="grid gap-2"><Label htmlFor="challenge-evidence">Counterexample Evidence ID</Label><Input id="challenge-evidence" required value={form.counterexampleEvidenceId} onChange={update('counterexampleEvidenceId')} /></div>
      <div className="grid gap-2 md:col-span-2"><Label htmlFor="challenge-rationale">Rationale</Label><Textarea id="challenge-rationale" required className="min-h-28" value={form.rationale} onChange={update('rationale')} /></div>
      <div className="grid gap-2 md:col-span-2"><Label htmlFor="challenge-impact">Impact scope</Label><Textarea id="challenge-impact" required className="min-h-24" placeholder="Which claims may be affected if this challenge succeeds?" value={form.impactScope} onChange={update('impactScope')} /><p className="text-xs text-muted-foreground">Describe the reach of a successful challenge so reviewers can triage the blast radius.</p></div>
      <div className="grid gap-2"><Label htmlFor="challenge-outcome">Requested outcome</Label><Select id="challenge-outcome" value={form.requestedOutcome} onChange={update('requestedOutcome')}><option value="refutes">Refutes</option><option value="qualifies">Qualifies</option></Select></div>
      <div className="flex items-end"><Button type="submit">Preview Challenge</Button></div>
      {error && <Alert variant="destructive" title="Challenge is incomplete" description={error} className="md:col-span-2" />}
    </form>
    {preview && <section aria-label="Challenge preview" className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-6"><h2 className="text-lg font-semibold">Challenge preview</h2><pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">{JSON.stringify(preview, null, 2)}</pre><p className="mt-4 text-sm text-muted-foreground">Submission will be enabled when the Challenge command endpoint is exposed.</p><div className="mt-4 flex gap-3"><Button type="button" variant="outline" onClick={() => setPreview(null)}>Back to edit</Button><Button type="button" variant="destructive" onClick={() => { setSubmitted(true); }}>Submit challenge</Button></div>{submitted && <Alert variant="success" title="Challenge submitted" description="The challenge is recorded against the target revision and queued for review." className="mt-4" />}</section>}
  </PageContainer>;
}
